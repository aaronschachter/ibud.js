'use strict';

const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const logger = require('winston');
const questions = require('./models/Question');
const users = require('./models/User');

const client = new twilio.RestClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function sendResponse(res, msgTxt) {
  const twiml = new twilio.TwimlResponse();
  twiml.message(msgTxt);
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
  console.log(twiml.toString());
}

router.post('/', function (req, res) {
  const senderId = req.body.From;

  const currentUser = users.findById(senderId)
    .populate('current_question')
    .exec();

  currentUser.then((user) => {
    if (!user) {
      return users.create({ _id: senderId })
        .then((user) => {
          const msg = 'Oh hey, I\'m Interviewbud -- a bot who asks you job interview questions.\n\nI don\'t know whether your answers are any good or not, I\'m just a bot here to help you practice.\n\nReady to begin?';

          return sendResponse(res, msg);    
        }) 
    }

    // TODO: Store user's current question to avoid asking same question twice.
    return questions.getRandomQuestionNotEqualTo(null)
      .then(question => sendResponse(res, question.title));
    })
    .catch(error => logger.log(error));
});

module.exports = router;
