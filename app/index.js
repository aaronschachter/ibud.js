'use strict';

const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap

const facebook = require('../lib/messenger');
const helpers = require('../lib/helpers');
const answers = require('./models/Answer');
const questions = require('./models/Question');
const users = require('./models/User')

function receivedMessage(event) {
  console.log('event');
  console.log(event);

  let currentQuestion;
  let currentUser;
  let responseText;
  const senderId = event.sender.id;
  const message = event.message;
  const postback = event.postback;

  if (postback && postback.payload === 'menu_about') {
    console.log(`menu_about:${senderId}`);
    facebook.sendTextMessage(senderId, helpers.greetingText);
  }

  if (postback && postback.payload === 'new_user') {
    console.log(`new_user:${senderId}`);

    return users.findByIdAndUpdate(senderId, { }, {
        new: true,
        upsert: true, 
      })
      .then((user) => {
        user.answered = false;
        console.log(`created new user:${senderId}`);

        return sendQuestion(user);
      })
      .catch(error => console.log(error));
  }

  users.findById(senderId)
    .populate('current_question')
    .exec()
    .then((user) => {
      if (!(user)) {
        // TODO: Safety check: new user should already have been created.
        return;
      }

      currentUser = user;

      // Safety check for current question, if not set, send one.
      if (!currentUser.current_question) {
        return sendQuestion(currentUser);
      }

      if (message.attachments) {
        responseText = 'Sorry, you can\'t answer an interview question with an attachment. If only.';
        facebook.sendTextMessage(senderId, responseText);

        return sendQuestion(currentUser);
      }

      if (message.text) {
        return answers.create({
          user: currentUser._id,
          question: currentUser.current_question._id,
          answer: message.text,
        })
        .then((answer) => {
          console.log(`created answer:${answer._id}`);

          return sendQuestion(currentUser);
        });
      }

      console.log('Did not send any response');
    })
    .catch(error => console.log(error));
}

/**
 * Send an interview question using the Send API.
 */
function sendQuestion(user) {
  console.log(`sendQuestion user:${user._id}`);
  let currentQuestion;

  // TODO: Only getRandomQuestion if User has answered.
  return questions.getRandom()
    .then((question) => {
      currentQuestion = question;
      user.current_question = currentQuestion._id;

      return user.save();
    })
    .then(() => facebook.sendGenericTemplate(user._id, 'Question', currentQuestion.title))
    .catch(error => console.log(error));
}

router.get('/webhook', function(req, res) {
  const token = process.env.MESSENGER_VALIDATION_TOKEN;
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

router.post('/webhook', function (req, res) {
  const data = req.body;

  if (data.object === 'page') {
    // Iterate over each entry, there may be multiple if batched.
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        receivedMessage(messagingEvent);
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

module.exports = router;
