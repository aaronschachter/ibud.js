'use strict';

const request = require('request');
const crypto = require('crypto');
const logger = require('winston');
const superagent = require('superagent');

const uri = 'https://graph.facebook.com/v2.6/me';
const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

module.exports.postMessage = function (data) {
  logger.debug('postMessage');

  return superagent
    .post(`${uri}/messages`)
    .set('Accept', 'application/json')
    .send(data)
    .query({ access_token: accessToken })
    .accept('json');
};

module.exports.postThreadSettings = function (json) {
  return request({
    method: 'POST',
    uri: `${uri}/thread_settings`,
    qs: { access_token: accessToken },
    json,
  });
};

module.exports.sendGenericTemplate = function (recipientId, title, subtitle) {
  const data = {
    recipient: {
      id: recipientId,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title,
            subtitle,
          }],
        },
      },
    },
  }

  return this.postMessage(data);
};

module.exports.sendTextMessage = function (recipientId, text) {
  const data = {
    recipient: {
      id: recipientId,
    },
    message: {
      text: text,
    }
  };

  return this.postMessage(data);
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
module.exports.verifyRequestSignature = function (req, res, buf) {
  logger.debug('verifyRequestSignature');
  const signature = req.headers['x-hub-signature'];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    logger.error('Couldn\'t validate the signature.');
  } else {
    const elements = signature.split('=');
    const method = elements[0];
    const signatureHash = elements[1];
    const expectedHash = crypto.createHmac('sha1', process.env.MESSENGER_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error('verifyRequestSignature success failed');
    }
    else {
      logger.debug('verifyRequestSignature success');
    }
  }
};
