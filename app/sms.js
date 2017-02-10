'use strict';

const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const questions = require('./models/Question');

const client = new twilio.RestClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

router.post('/', function (req, res) {

  return questions.getRandomQuestionNotEqualTo(null)
    // TODO: Find incoming number to determine if this is first message sent. If so, send welcome.
    .then(question => {
      const twiml = new twilio.TwimlResponse();
      twiml.message(question.title);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(twiml.toString());
      console.log(twiml.toString());
    })
    .catch(error => console.log(error));
});

module.exports = router;
