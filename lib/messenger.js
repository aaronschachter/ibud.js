'use strict';

const request = require('request');
const uri = 'https://graph.facebook.com/v2.6/me';
const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

module.exports.postMessage = function (json) {
  return request({
    uri: `${uri}/messages`,
    qs: { access_token: accessToken },
    method: 'POST',
    json,
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      const recipientId = body.recipient_id;
      const messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", messageId, recipientId);
      } else {
        console.log("Successfully called Send API for recipient %s", recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
};

module.exports.postThreadSettings = function (json) {
  return request({
    method: 'POST',
    uri: `${uri}/thread_settings`,
    qs: { access_token: accessToken },
    json,
  });
};
