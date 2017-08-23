var NodeHelper = require('node_helper');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var MemoryDataStore = require('@slack/client').MemoryDataStore;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var WebClient = require('@slack/client').WebClient;

module.exports = NodeHelper.create({

  start: function() {
    this.messages = [];
    console.log('Starting node helper for: ' + this.name);
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'START_CONNECTION') {
      this.startSlackConnection(payload.config);
    }
  },

  sendChannelMessages: function(err, result) {
    var rtm = this.rtm
    if (err)
      return console.log(err);
    if (!result.ok)
      return console.log(result.error);
    if (result.warning)
      console.log(result.warning);
    var slackMessages = [];
    result.messages.forEach(function(message) {
      if (!message.subtype) {
        var slackMessage = {
          'messageId': message.ts,
          'user': rtm.dataStore.getUserById(message.user).name,
          'message': message.text
        };
        slackMessages.push(slackMessage);
      }
    });
    this.messages = slackMessages;
    this.broadcastMessage();
  },

  startSlackConnection: function(config) {
    this.config = config
    this.token = process.env.SLACK_API_TOKEN || this.config.slackToken;

    this.rtm = new RtmClient(this.token, {
      logLevel: 'error',
      dataStore: new MemoryDataStore()
    });

    this.rtm.start();
    if (this.config.showLatestMessageOnStartup || this.config.messageMode == 'random')
      this.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, this.broadcastMessageHistory.bind(this));

    this.rtm.on(RTM_EVENTS.MESSAGE, this.handleRtmMessage.bind(this));
  },

  handleRtmMessage: function(slackMessage) {
    var channelName = this.rtm.dataStore.getChannelGroupOrDMById(slackMessage.channel).name;
    if (channelName != this.config.slackChannel)
      return;
    if (slackMessage.subtype != null) {
      switch (slackMessage.subtype) {
        case 'message_changed':
          for (var i = 0; i < this.messages.length - 1; i++) {
            if (this.messages[i].messageId === slackMessage.message.ts) {
              var userName = this.rtm.dataStore.getUserById(slackMessage.message.user).name;
              this.messages[i].user = userName;
              this.messages[i].message = slackMessage.message.text;
            }
          }
          break;
        case 'message_deleted':
          for (var i = 0; i < this.messages.length - 1; i++) {
            if (this.messages[i].messageId === slackMessage.deleted_ts) {
              this.messages.splice(i, 1);
            }
          }
          break;
      }
    } else {
      if (slackMessage.text == 'clear') {
        this.messages = []
      } else {
        var userName = this.rtm.dataStore.getUserById(slackMessage.user).name;
        this.messages.unshift({
          'messageId': slackMessage.ts,
          'user': userName,
          'message': slackMessage.text
        });
      }
    }
    this.broadcastMessage();
  },

  broadcastMessageHistory: function() {
    var web = new WebClient(this.token);
    var channel = this.rtm.dataStore.getChannelByName(this.config.slackChannel) ||
                  this.rtm.dataStore.getGroupByName(this.config.slackChannel);

    if (channel.is_channel) {
      web.channels.history(channel.id, this.sendChannelMessages.bind(this));
    } else {
      web.groups.history(channel.id, this.sendChannelMessages.bind(this));
    }
  },

  broadcastMessage: function() {
    this.sendSocketNotification('SLACK_DATA', this.messages);
  }
});
