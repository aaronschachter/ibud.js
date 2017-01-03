'use strict';

const request = require('request');
const uri = 'https://graph.facebook.com/v2.6/me';

/**
 * Post given data as Facebook messeage. 
 */
module.exports.postMessage = function (data) {
  request({
    uri: `${uri}/messages`,
    qs: { access_token: process.env.MESSENGER_PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: data,
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
