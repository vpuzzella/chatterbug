var Chatterbug = {
  config: ChatterbugConfig,
  connection: null,
  mainPanel: null,

  jidToDomId: function (jid) {
    return Strophe.getBareJidFromJid(jid).replace(/@|\./, "-");
  },

  localPartFromJid: function(jid){
    return jid.replace(/@.*/, '');
  },

  connectionStatuses: $(['disconnected', 'connecting', 'connected', 'error', 'authenticating', 'disconnecting', 'authfail', 'connfail']),

  createMainPanel: function(){
    var label   = $(document.createElement('a')).attr('href', '#').text('Chatterbug');

    var status  = $(document.createElement('span')).addClass('connection-status')
      .append($(document.createElement('label')));

    var handle  = $(document.createElement('div')).addClass('handle')
      .append(label)
      .append(status);

    var presenceSelector = $(document.createElement('select'))
      .append("<option>Available</option><option value='unavailable'>Unavailable</option>")
      .change(function(){
        if(!Chatterbug.connection) return;
        Chatterbug.connection.send($pres({type: $(this).find(':selected').val()}));
      });

    var presence = $(document.createElement('div'))
      .addClass('presence')
      .append($(document.createElement('label'))
        .text(Chatterbug.localPartFromJid(Chatterbug.config.jid) + ':'))
      .append(presenceSelector);

    var roster      = $(document.createElement('ul')).addClass('roster');

    Chatterbug.mainPanel = $(document.createElement('div'))
      .attr('id', 'chatterbug-main-panel')
      .addClass('chatterbug-panel')
      .append(handle)
      .append(presence)
      .append(roster)
      .extend({
        handle: handle,
        connectionStatus: status,
        presence: presence,
        roster: roster});

    $('body').append(Chatterbug.updateMainPanel);

    return Chatterbug.updateMainPanel();
  },

  updateMainPanel: function(){
    Chatterbug.mainPanel.unbind();
    Chatterbug.mainPanel.handle.unbind();
    Chatterbug.mainPanel.tabSlideOut({
      tabHandle: Chatterbug.mainPanel.handle,
      tabLocation: 'bottom',
      speed: 300,
      leftPos: '200px',
      fixedPosition: true
    });

    // Adjust some weird TabSlideOut CSS
    Chatterbug.mainPanel.handle.css({textIndent: '0px'});
    //Chatterbug.mainPanel.css({lineHeight: 'default'});

    return Chatterbug.mainPanel;
  },

  updateConnectionStatus: function(status){
    Chatterbug.connectionStatuses.each(function(i, s){
      Chatterbug.mainPanel.connectionStatus.removeClass(s)
    });
    Chatterbug.mainPanel.connectionStatus
      .addClass(status)
      .find('label')
      .text('(' + status + ')');
  },

  onConnected: function(){
    Chatterbug.updateConnectionStatus('connected');
    
    Chatterbug.connection.addHandler(Chatterbug.onPresence,       null,               "presence"          );
    Chatterbug.connection.addHandler(Chatterbug.onRosterChanged,  "jabber:iq:roster", "iq",       "set"   );
    Chatterbug.connection.addHandler(Chatterbug.onMessage,        null,               "message",  "chat"  );

    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Chatterbug.connection.sendIQ(iq, Chatterbug.onRoster);
    Chatterbug.connection.send($pres());
  },

  onDisconnected: function(){
    Chatterbug.updateConnectionStatus('disconnected');
    $('#roster-area ul').empty();
    $('#chat-area ul').empty();
    $('#chat-area div').remove();
    $('#login_dialog').dialog('open');
    Chatterbug.connection = null;
    Chatterbug.pending_subscriber = null;
  },

  connect: function(){
    Chatterbug.connection = new Strophe.Connection(Chatterbug.config.bosh_uri);
    Chatterbug.connection.connect(Chatterbug.config.jid, Chatterbug.config.password, function(status){
      switch(status){
        case Strophe.Status.CONNECTING:     Chatterbug.updateConnectionStatus('connecting'); break;
        case Strophe.Status.CONNECTED:      Chatterbug.onConnected(); break;
        case Strophe.Status.DISCONNECTED:   Chatterbug.onDisconnected(); break;
        case Strophe.Status.ERROR:          Chatterbug.updateConnectionStatus('error'); break;
        case Strophe.Status.CONNFAIL:       Chatterbug.updateConnectionStatus('connfail'); break;
        case Strophe.Status.AUTHENTICATING: Chatterbug.updateConnectionStatus('authenticating'); break;
        case Strophe.Status.AUTHFAIL:       Chatterbug.updateConnectionStatus('authfail'); break;
        case Strophe.Status.DISCONNECTING:  Chatterbug.updateConnectionStatus('disconnecting'); break;
      }
    });
    return Chatterbug.connection;
  },

  disconnect: function(){
    Chatterbug.connection.disconnect();
    Chatterbug.onDisconnected();
  },

  onRoster: function (iq) {
    $(iq).find('item').each(function () {
      var jid = $(this).attr('jid');
      var name = $(this).attr('name') || jid;

      // transform jid into an id
      var jid_id = Chatterbug.jidToDomId(jid);

      var contact = $("<li id='" + jid_id + "'>" +
        "<div class='roster-contact offline'>" +
        "<div class='roster-name'>" +
        name +
        "</div><div class='roster-jid'>" +
        jid +
        "</div></div></li>");

      Chatterbug.insertContact(contact);
    });
  },

  pending_subscriber: null,

//  onPresence: function (presence) {
//    var ptype = $(presence).attr('type');
//    var from = $(presence).attr('from');
//    var jid_id = Chatterbug.jidToDomId(from);
//
//    if (ptype === 'subscribe') {
//      // populate pending_subscriber, the approve-jid span, and
//      // open the dialog
//      Chatterbug.pending_subscriber = from;
//      $('#approve-jid').text(Strophe.getBareJidFromJid(from));
//      $('#approve_dialog').dialog('open');
//    } else if (ptype !== 'error') {
//      var contact = $('#roster-area li#' + jid_id + ' .roster-contact')
//      .removeClass("online")
//      .removeClass("away")
//      .removeClass("offline");
//      if (ptype === 'unavailable') {
//        contact.addClass("offline");
//      } else {
//        var show = $(presence).find("show").text();
//        if (show === "" || show === "chat") {
//          contact.addClass("online");
//        } else {
//          contact.addClass("away");
//        }
//      }
//
//      var li = contact.parent();
//      li.remove();
//      Chatterbug.insertContact(li);
//    }
//
//    // reset addressing for user since their presence changed
//    var jid_id = Chatterbug.jidToDomId(from);
//    $('#chat-' + jid_id).data('jid', Strophe.getBareJidFromJid(from));
//
//    return true;
//  },

  onPresence: function (presence) {
    var ptype = $(presence).attr('type');
    var from = $(presence).attr('from');
    var jid_id = Chatterbug.jidToDomId(from);

    if (ptype === 'subscribe') {
      // populate pending_subscriber, the approve-jid span, and
      // open the dialog
      Chatterbug.pending_subscriber = from;
      $('#approve-jid').text(Strophe.getBareJidFromJid(from));
      $('#approve_dialog').dialog('open');
    } else if (ptype !== 'error') {
      var contact = Chatterbug.mainPanel.roster.find('li#' + jid_id + ' .roster-contact')
      .removeClass("online")
      .removeClass("away")
      .removeClass("offline");
      if (ptype === 'unavailable') {
        contact.addClass("offline");
      } else {
        var show = $(presence).find("show").text();
        if (show === "" || show === "chat") {
          contact.addClass("online");
        } else {
          contact.addClass("away");
        }
      }

      var li = contact.parent();
      li.remove();
      Chatterbug.insertContact(li);
    }

    // reset addressing for user since their presence changed
    var jid_id = Chatterbug.jidToDomId(from);
    $('#chat-' + jid_id).data('jid', Strophe.getBareJidFromJid(from));

    return true;
  },

  onRosterChanged: function (iq) {
    $(iq).find('item').each(function () {
      var sub = $(this).attr('subscription');
      var jid = $(this).attr('jid');
      var name = $(this).attr('name') || jid;
      var jid_id = Chatterbug.jidToDomId(jid);

      if (sub === 'remove') {
        // contact is being removed
        $('#' + jid_id).remove();
      } else {
        // contact is being added or modified
        var contact_html = "<li id='" + jid_id + "'>" +
        "<div class='" +
        ($('#' + jid_id).attr('class') || "roster-contact offline") +
        "'>" +
        "<div class='roster-name'>" +
        name +
        "</div><div class='roster-jid'>" +
        jid +
        "</div></div></li>";

        if ($('#' + jid_id).length > 0) {
          $('#' + jid_id).replaceWith(contact_html);
        } else {
          Chatterbug.insertContact(contact_html);
        }
      }
    });

    return true;
  },

  onMessage: function (message) {
    var full_jid = $(message).attr('from');
    var jid = Strophe.getBareJidFromJid(full_jid);
    var jid_id = Chatterbug.jidToDomId(jid);

    if ($('#chat-' + jid_id).length === 0) {
      $('#chat-area').tabs('add', '#chat-' + jid_id, jid);
      $('#chat-' + jid_id).append(
        "<div class='chat-messages'></div>" +
        "<input type='text' class='chat-input'>");
    }
        
    $('#chat-' + jid_id).data('jid', full_jid);

    $('#chat-area').tabs('select', '#chat-' + jid_id);
    $('#chat-' + jid_id + ' input').focus();

    var composing = $(message).find('composing');
    if (composing.length > 0) {
      $('#chat-' + jid_id + ' .chat-messages').append(
        "<div class='chat-event'>" +
        Strophe.getNodeFromJid(jid) +
        " is typing...</div>");

      Chatterbug.scroll_chat(jid_id);
    }

    var body = $(message).find("html > body");

    if (body.length === 0) {
      body = $(message).find('body');
      if (body.length > 0) {
        body = body.text()
      } else {
        body = null;
      }
    } else {
      body = body.contents();

      var span = $("<span></span>");
      body.each(function () {
        if (document.importNode) {
          $(document.importNode(this, true)).appendTo(span);
        } else {
          // IE workaround
          span.append(this.xml);
        }
      });

      body = span;
    }

    if (body) {
      // remove notifications since user is now active
      $('#chat-' + jid_id + ' .chat-event').remove();

      // add the new message
      $('#chat-' + jid_id + ' .chat-messages').append(
        "<div class='chat-message'>" +
        "&lt;<span class='chat-name'>" +
        Strophe.getNodeFromJid(jid) +
        "</span>&gt;<span class='chat-text'>" +
        "</span></div>");

      $('#chat-' + jid_id + ' .chat-message:last .chat-text')
      .append(body);

      Chatterbug.scroll_chat(jid_id);
    }

    return true;
  },

  scroll_chat: function (jid_id) {
    var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
    div.scrollTop = div.scrollHeight;
  },


  presence_value: function (elem) {
    if (elem.hasClass('online')) {
      return 2;
    } else if (elem.hasClass('away')) {
      return 1;
    }

    return 0;
  },

//  insertContact: function (elem) {
//    var jid = elem.find('.roster-jid').text();
//    var pres = Chatterbug.presence_value(elem.find('.roster-contact'));
//
//    var contacts = $('#roster-area li');
//
//    if (contacts.length > 0) {
//      var inserted = false;
//      contacts.each(function () {
//        var cmp_pres = Chatterbug.presence_value(
//          $(this).find('.roster-contact'));
//        var cmp_jid = $(this).find('.roster-jid').text();
//
//        if (pres > cmp_pres) {
//          $(this).before(elem);
//          inserted = true;
//          return false;
//        } else {
//          if (jid < cmp_jid) {
//            $(this).before(elem);
//            inserted = true;
//            return false;
//          }
//        }
//      });
//
//      if (!inserted) {
//        $('#roster-area ul').append(elem);
//      }
//    } else {
//      $('#roster-area ul').append(elem);
//    }
//  },

  insertContact: function (elem) {
    var jid = elem.find('.roster-jid').text();
    var pres = Chatterbug.presence_value(elem.find('.roster-contact'));

    var contacts = Chatterbug.mainPanel.roster.find('li');

    if (contacts.length > 0) {
      var inserted = false;
      contacts.each(function () {
        var cmp_pres = Chatterbug.presence_value(
          $(this).find('.roster-contact'));
        var cmp_jid = $(this).find('.roster-jid').text();

        if (pres > cmp_pres) {
          $(this).before(elem);
          inserted = true;
          return false;
        } else {
          if (jid < cmp_jid) {
            $(this).before(elem);
            inserted = true;
            return false;
          }
        }
      });

      if (!inserted) {
        Chatterbug.mainPanel.roster.append(elem);
      }
    } else {
      Chatterbug.mainPanel.roster.append(elem);
    }
    Chatterbug.updateMainPanel();
  }
};

$(document).ready(function () {
  Chatterbug.createMainPanel();

  Chatterbug.connect();


  $('#contact_dialog').dialog({
    autoOpen: false,
    draggable: false,
    modal: true,
    title: 'Add a Contact',
    buttons: {
      "Add": function () {
        Chatterbug.mainPanel.trigger('contact_added', {
          jid: $('#contact-jid').val(),
          name: $('#contact-name').val()
        });

        $('#contact-jid').val('');
        $('#contact-name').val('');
                
        $(this).dialog('close');
      }
    }
  });

  $('#new-contact').click(function (ev) {
    $('#contact_dialog').dialog('open');
  });

  $('#approve_dialog').dialog({
    autoOpen: false,
    draggable: false,
    modal: true,
    title: 'Subscription Request',
    buttons: {
      "Deny": function () {
        Chatterbug.connection.send($pres({
          to: Chatterbug.pending_subscriber,
          "type": "unsubscribed"
        }));
        Chatterbug.pending_subscriber = null;

        $(this).dialog('close');
      },

      "Approve": function () {
        Chatterbug.connection.send($pres({
          to: Chatterbug.pending_subscriber,
          "type": "subscribed"
        }));

        Chatterbug.connection.send($pres({
          to: Chatterbug.pending_subscriber,
          "type": "subscribe"
        }));
                
        Chatterbug.pending_subscriber = null;

        $(this).dialog('close');
      }
    }
  });

  $('#chat-area').tabs().find('.ui-tabs-nav').sortable({
    axis: 'x'
  });

  $('.roster-contact').live('click', function () {
    var jid = $(this).find(".roster-jid").text();
    var name = $(this).find(".roster-name").text();
    var jid_id = Chatterbug.jidToDomId(jid);

    if ($('#chat-' + jid_id).length === 0) {
      $('#chat-area').tabs('add', '#chat-' + jid_id, name);
      $('#chat-' + jid_id).append(
        "<div class='chat-messages'></div>" +
        "<input type='text' class='chat-input'>");
      $('#chat-' + jid_id).data('jid', jid);
    }
    $('#chat-area').tabs('select', '#chat-' + jid_id);

    $('#chat-' + jid_id + ' input').focus();
  });

  $('.chat-input').live('keypress', function (ev) {
    var jid = $(this).parent().data('jid');

    if (ev.which === 13) {
      ev.preventDefault();

      var body = $(this).val();

      var message = $msg({
        to: jid,
        "type": "chat"
      })
      .c('body').t(body).up()
      .c('active', {
        xmlns: "http://jabber.org/protocol/chatstates"
      });
      Chatterbug.connection.send(message);

      $(this).parent().find('.chat-messages').append(
        "<div class='chat-message'>&lt;" +
        "<span class='chat-name me'>" +
        Strophe.getNodeFromJid(Chatterbug.connection.jid) +
        "</span>&gt;<span class='chat-text'>" +
        body +
        "</span></div>");
      Chatterbug.scroll_chat(Chatterbug.jidToDomId(jid));

      $(this).val('');
      $(this).parent().data('composing', false);
    } else {
      var composing = $(this).parent().data('composing');
      if (!composing) {
        var notify = $msg({
          to: jid,
          "type": "chat"
        })
        .c('composing', {
          xmlns: "http://jabber.org/protocol/chatstates"
        });
        Chatterbug.connection.send(notify);

        $(this).parent().data('composing', true);
      }
    }
  });

  $('#disconnect').click(function () {
    Chatterbug.disconnect();
  });

  $('#chat_dialog').dialog({
    autoOpen: false,
    draggable: false,
    modal: true,
    title: 'Start a Chat',
    buttons: {
      "Start": function () {
        var jid = $('#chat-jid').val();
        var jid_id = Chatterbug.jidToDomId(jid);

        $('#chat-area').tabs('add', '#chat-' + jid_id, jid);
        $('#chat-' + jid_id).append(
          "<div class='chat-messages'></div>" +
          "<input type='text' class='chat-input'>");
            
        $('#chat-' + jid_id).data('jid', jid);
            
        $('#chat-area').tabs('select', '#chat-' + jid_id);
        $('#chat-' + jid_id + ' input').focus();
            
            
        $('#chat-jid').val('');
                
        $(this).dialog('close');
      }
    }
  });

  $('#new-chat').click(function () {
    $('#chat_dialog').dialog('open');
  });
  
  Chatterbug.mainPanel.bind('contact_added', function (ev, data) {
    var iq = $iq({
      type: "set"
    }).c("query", {
      xmlns: "jabber:iq:roster"
    })
    .c("item", data);
    Chatterbug.connection.sendIQ(iq);

    var subscribe = $pres({
      to: data.jid,
      "type": "subscribe"
    });
    Chatterbug.connection.send(subscribe);

    stopPropogation();
  });
});