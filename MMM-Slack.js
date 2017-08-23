Module.register('MMM-Slack', {
  defaults: {
    showLatestMessageOnStartup: false,
    showUserName: true,
    messageMode: 'random',  // or 'latest'
    updateRate: 10000
  },

  getStyles: function() {
    return ['slack.css'];
  },

  start: function() {
    this.slackMessages = [];
    this.openSlackConnection();
    var self = this;
    setInterval(function() {
      self.updateDom(1000);
    }, this.config.updateRate);
  },

  openSlackConnection: function() {
    this.sendSocketNotification('START_CONNECTION', {
      config: this.config
    });
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'SLACK_DATA') {
      if (payload != null) {
        this.slackMessages = payload;
        this.updateDom(2.5 * 1000);
      }
    }
  },

  getDom: function() {
    var messageElement = document.createElement('div');
    messageElement.className = 'light xlarge';
    if (this.slackMessages.length > 0) {
      if (this.config.messageMode == 'random')
        var messageId = Math.floor(Math.random() * this.slackMessages.length);
      else if (this.config.messageMode == 'latest')
        var messageId = 0;
      messageElement.innerHTML = this.slackMessages[messageId].message;
      if (this.config.showUserName) {
        var userElement = document.createElement('p');
        userElement.className = 'user';
        userElement.innerHTML = '@' + this.slackMessages[messageId].user;
        messageElement.appendChild(userElement);
      }
    }
    return messageElement;
  }
});
