'use strict';

const request = require('request');
const crypto = require('crypto');
const uri = 'https://graph.facebook.com/v2.6/me';
const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
module.exports.verifyRequestSignature = function (req, res, buf) {
  console.log('verifyRequestSignature');
  const signature = req.headers['x-hub-signature'];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    const elements = signature.split('=');
    const method = elements[0];
    const signatureHash = elements[1];
    const expectedHash = crypto.createHmac('sha1', process.env.MESSENGER_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("verifyRequestSignature success failed");
    }
    else {
      console.log('verifyRequestSignature success');
    }
  }
};

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
