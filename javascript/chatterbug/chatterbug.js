var Chatterbug = {
  config: ChatterbugConfig,
  connection: null,
  mainPanel: null,
  roster: null,

  jidToDomId: function (jid) {
    return Strophe.getBareJidFromJid(jid).replace(/@|\./, "-");
  },

  localPartFromJid: function(jid){
    return jid.replace(/@.*/, '');
  },

  createMainPanel: function(){
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

    Chatterbug.roster = $(document.createElement('ul'))
      .addClass('roster')
      .extend({
        contact: function(jid){
          return $(this).find('#' + Chatterbug.jidToDomId(jid));
        },

        insertContact: function(elem) {
          var jid = elem.find('.jid').text();
          var pres = Chatterbug.presence_value(elem);

          var contacts = $(this).find('.contact');
          
          if (contacts.length > 0) {
            var inserted = false;
            contacts.each(function () {
              var cmp_pres = Chatterbug.presence_value($(this));
              var cmp_jid = $(this).find('.jid').text();

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
              $(this).append(elem);
            }
          } else {
            $(this).append(elem);
          }
        }
      });
    
    var content = $(document.createElement('div'))
      .addClass('content')
      .css('display', 'none')
      .append(presence)
      .append(Chatterbug.roster)

    var label = $(document.createElement('span')).text('Chat:');

    var status = $(document.createElement('span')).addClass('connection-status')
      .append($(document.createElement('label')));

    var handle = $(document.createElement('div')).addClass('handle')
      .append(label)
      .append(status)
      .click(function(){
        Chatterbug.mainPanel.content.toggle();
      });

    Chatterbug.mainPanel = $(document.createElement('div'))
      .attr('id', 'chatterbug-main-panel')
      .addClass('chatterbug-panel')
      .append(content)
      .append(handle)
      .extend({
        content: content,
        presence: presence,
        roster: Chatterbug.roster,
        handle: handle,
        connectionStatus: status
      }
    );
      
    $('body').append(Chatterbug.mainPanel);
    
    return Chatterbug.mainPanel;
  },

  updateConnectionStatus: function(status){
    $(['disconnected', 'connecting', 'connected', 'error', 'authenticating', 'disconnecting', 'authfail', 'connfail']).each(function(i, s){
      Chatterbug.mainPanel.removeClass(s)
    });
    Chatterbug.mainPanel.addClass(status)
      .connectionStatus
        .find('label')
        .text(status);
  },

  onConnected: function(){
    Chatterbug.connection.addHandler(Chatterbug.onPresenceReceived, null, "presence");
    Chatterbug.connection.addHandler(Chatterbug.onRosterChanged, "jabber:iq:roster", "iq", "set");
    Chatterbug.connection.addHandler(Chatterbug.onMessageReceived, null, "message",  "chat");

    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Chatterbug.connection.sendIQ(iq, Chatterbug.onRosterReceived);
    Chatterbug.connection.send($pres());

    Chatterbug.updateConnectionStatus('connected');
  },

  onDisconnected: function(){
    Chatterbug.updateConnectionStatus('disconnected');
    $('#roster-area ul').empty();
    $('#chat-area ul').empty();
    $('#chat-area div').remove();
    $('#login_dialog').dialog('open');
    Chatterbug.connection = null;
  },

  connect: function(){
    Chatterbug.connection = new Strophe.Connection(Chatterbug.config.bosh_uri);
    Chatterbug.connection.connect(Chatterbug.config.jid, Chatterbug.config.password, function(status){
      switch(status){
        case Strophe.Status.CONNECTING: Chatterbug.updateConnectionStatus('connecting'); break;
        case Strophe.Status.CONNECTED: Chatterbug.onConnected(); break;
        case Strophe.Status.DISCONNECTED: Chatterbug.onDisconnected(); break;
        case Strophe.Status.ERROR: Chatterbug.updateConnectionStatus('error'); break;
        case Strophe.Status.CONNFAIL: Chatterbug.updateConnectionStatus('connfail'); break;
        case Strophe.Status.AUTHENTICATING: Chatterbug.updateConnectionStatus('authenticating'); break;
        case Strophe.Status.AUTHFAIL: Chatterbug.updateConnectionStatus('authfail'); break;
        case Strophe.Status.DISCONNECTING: Chatterbug.updateConnectionStatus('disconnecting'); break;
      }
    });
    return Chatterbug.connection;
  },

  disconnect: function(){
    Chatterbug.connection.disconnect();
    Chatterbug.onDisconnected();
  },

  createContact: function(data){
    var jid = data.jid
    var name = data.name
    var dom_id = Chatterbug.jidToDomId(jid);

    return $(document.createElement('li'))
      .attr('id', dom_id)
      .addClass((Chatterbug.roster.contact(jid).attr('class') || "contact offline"))
      .append(
        $(document.createElement('div'))
          .addClass('actions')
          .append($(document.createElement('a')).
            addClass('remove').attr('href', '#')
            .text('X')
            .attr('title', 'Remove contact')
          )
      )
      .append(
        $(document.createElement('div'))
          .append($(document.createElement('div'))
            .addClass('name')
            .attr('title', jid)
            .text(name)
            
          )
          .append($(document.createElement('div'))
            .addClass('jid')
            .css('display', (name ? 'none':'block'))
            .text(jid)
          )
      );
  },

  onRosterReceived: function (iq) {
    $(iq).find('item').each(function () {
      var jid = $(this).attr('jid');
      var name = $(this).attr('name');
      Chatterbug.roster.insertContact(Chatterbug.createContact({jid: jid, name: name}));
    });
  },

  onSubscriptionRequest: function(from){
    var notice = $.pnotify({
      pnotify_text:
        '<div class="chatterbug-notice">' +
          '<h1>Subscription Request</h1>' +
          '<p><label>From:</label> ' + from + '</p>' +
        '</div>' +
        '<div>' +
          '<button class="accept">Accept</button>' +
          '<button class="deny">Deny</button>' +
        '</div>',
      pnotify_width: 'auto',
      pnotify_hide: false
    });

    notice.find('button').click(function(){
      if($(this).hasClass('deny')){
        Chatterbug.connection.send($pres({
          to: from,
          "type": "unsubscribed"
        }));
      } else {
        Chatterbug.connection.send($pres({
          to: from,
          "type": "subscribed"
        }));
        Chatterbug.connection.send($pres({
          to: from,
          "type": "subscribe"
        }));
      }
      notice.pnotify_remove();
      return false;
    });
  },

  onPresenceReceived: function (presence) {
    var from = $(presence).attr('from');
    var ptype   = $(presence).attr('type');

    if (ptype == 'subscribe') {
      Chatterbug.onSubscriptionRequest(from);
    } else if (ptype != 'error') {
      var contact = Chatterbug.roster.contact(from)
        .removeClass("online")
        .removeClass("away")
        .removeClass("offline");
        
      if (ptype == 'unavailable') {
        contact.addClass("offline");
      } else {
        var show = $(presence).find("show").text();
        if (show == "" || show == "chat") {
          contact.addClass("online");
        } else {
          contact.addClass("away");
        }
      }
      contact.remove();
      Chatterbug.roster.insertContact(contact);
    }

    // reset addressing for user since their presence changed
    var dom_id = Chatterbug.jidToDomId(from);
    $('#chat-' + dom_id).data('jid', Strophe.getBareJidFromJid(from));

    return true;
  },

  onRosterChanged: function (iq) {
    $(iq).find('item').each(function () {
      var sub     = $(this).attr('subscription');
      var jid     = $(this).attr('jid');
      var name    = $(this).attr('name') || jid;
      
      if (sub == 'remove') {
        Chatterbug.onContactRemoved(jid);
      } else {
        // contact is being added or modified
        if (Chatterbug.roster.contact(jid).length > 0) {
          Chatterbug.onContactChanged({jid: jid, name: name});
        } else {
          Chatterbug.onContactAdded({jid: jid, name: name});
        }
      }
    });
  },

  onMessageReceived: function (message) {
    var full_jid = $(message).attr('from');
    var jid = Strophe.getBareJidFromJid(full_jid);
    var dom_id = Chatterbug.jidToDomId(jid);

    if ($('#chat-' + dom_id).length === 0) {
      $('#chat-area').tabs('add', '#chat-' + dom_id, jid);
      $('#chat-' + dom_id).append(
        "<div class='chat-messages'></div>" +
        "<input type='text' class='chat-input'>");
    }
        
    $('#chat-' + dom_id).data('jid', full_jid);

    $('#chat-area').tabs('select', '#chat-' + dom_id);
    $('#chat-' + dom_id + ' input').focus();

    var composing = $(message).find('composing');
    if (composing.length > 0) {
      $('#chat-' + dom_id + ' .chat-messages').append(
        "<div class='chat-event'>" +
        Strophe.getNodeFromJid(jid) +
        " is typing...</div>");

      Chatterbug.scroll_chat(dom_id);
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
      $('#chat-' + dom_id + ' .chat-event').remove();

      // add the new message
      $('#chat-' + dom_id + ' .chat-messages').append(
        "<div class='chat-message'>" +
        "&lt;<span class='chat-name'>" +
        Strophe.getNodeFromJid(jid) +
        "</span>&gt;<span class='chat-text'>" +
        "</span></div>");

      $('#chat-' + dom_id + ' .chat-message:last .chat-text')
      .append(body);

      Chatterbug.scroll_chat(dom_id);
    }

    return true;
  },

  scroll_chat: function (dom_id) {
    var div = $('#chat-' + dom_id + ' .chat-messages').get(0);
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

  addContact: function(data) {
    Chatterbug.connection.sendIQ(
      $iq({type: "set"})
        .c("query", {xmlns: "jabber:iq:roster"})
        .c("item", data)
    );
    Chatterbug.connection.send($pres({to: data.jid, type: 'subscribe'}));
    Chatterbug.onContactAdded(data);
  },

  onContactAdded: function(data){
    Chatterbug.roster.insertContact(Chatterbug.createContact(data));
  },

  onContactChanged: function(data){
    Chatterbug.roster.contact(data.jid).replaceWith(Chatterbug.createContact(data));
  },

  removeContact: function(jid){
    Chatterbug.connection.sendIQ(
      $iq({type: 'set'})
        .c('query', {xmlns: Strophe.NS.ROSTER})
        .c('item', {jid: jid, subscription: 'remove'})
    );
    Chatterbug.onContactRemoved(jid);
  },

  onContactRemoved: function(jid){
    Chatterbug.roster.contact(jid).remove();
  }
};

$(document).ready(function () {
  Chatterbug.createMainPanel();

  Chatterbug.connect();

  Chatterbug.roster.find('a.remove').live('click', function(event){
    Chatterbug.removeContact($(event.target).closest('li').find('.jid').text());
    return false;
  });

  $('#contact_dialog').dialog({
    autoOpen: false,
    draggable: false,
    modal: true,
    title: 'Add a Contact',
    buttons: {
      "Add": function(){
        Chatterbug.addContact({
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

  $('#chat-area').tabs().find('.ui-tabs-nav').sortable({
    axis: 'x'
  });

  Chatterbug.roster.find('.contact').live('click', function () {
    var jid = $(this).find(".jid").text();
    var name = $(this).find(".name").text();
    var dom_id = Chatterbug.jidToDomId(jid);

    if ($('#chat-' + dom_id).length === 0) {
      $('#chat-area').tabs('add', '#chat-' + dom_id, name);
      $('#chat-' + dom_id).append(
        "<div class='chat-messages'></div>" +
        "<input type='text' class='chat-input'>");
      $('#chat-' + dom_id).data('jid', jid);
    }
    $('#chat-area').tabs('select', '#chat-' + dom_id);

    $('#chat-' + dom_id + ' input').focus();
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
        var dom_id = Chatterbug.jidToDomId(jid);

        $('#chat-area').tabs('add', '#chat-' + dom_id, jid);
        $('#chat-' + dom_id).append(
          "<div class='chat-messages'></div>" +
          "<input type='text' class='chat-input'>");
            
        $('#chat-' + dom_id).data('jid', jid);
            
        $('#chat-area').tabs('select', '#chat-' + dom_id);
        $('#chat-' + dom_id + ' input').focus();
            
            
        $('#chat-jid').val('');
                
        $(this).dialog('close');
      }
    }
  });

  $('#new-chat').click(function () {
    $('#chat_dialog').dialog('open');
  });
});