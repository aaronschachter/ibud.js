'use strict';

const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap
const logger = require('winston');

const facebook = require('../lib/messenger');
const helpers = require('../lib/helpers');
const answers = require('./models/Answer');
const messages = require('./models/Message');
const questions = require('./models/Question');
const users = require('./models/User')

/**
 * Handles messages sent to our Messenger webhook.
 */
function receivedMessage(event) {
  logger.info(`received event:${JSON.stringify(event)}`);

  const senderId = event.sender.id;
  const message = event.message;
  const postback = event.postback;

  let currentMessage = {
    _id: event.message.mid,
    timestamp: event.timestamp,
  };
  let currentUser;
  const update = { last_sent_message: message.mid };
  const options =  { new: true, upsert: true };

  return users
    .findByIdAndUpdate(senderId, update, options)
    .populate('current_question')
    .then((user) => {
      logger.info(`loaded user:${user._id}`);
      currentUser = user;
      currentMessage.user = currentUser._id;

      if (postback && postback.payload === 'menu_about') {
        logger.info(`menu_about:${senderId}`);
        currentMessage.response_type = 'menu_about';
        facebook.sendTextMessage(senderId, helpers.greetingText);

        return sendCurrentQuestion(currentUser);
      }

      if (message.attachments) {
        currentMessage.response_type = 'attachments';
        currentMessage.attachments = message.attachments;
        const text = 'Sorry, I don\'t understand, I\'m just a bot. Please send your answer as text.';
        facebook.sendTextMessage(senderId, text);

        return sendCurrentQuestion(currentUser);
      }

      if (message.text) {
        currentMessage.text = message.text;
        // Check if sent message is a command. 
        const command = message.text.toLowerCase();
        if (command === 'help' || command === 'question' || command === 'q') {
          currentMessage.response_type = 'help';
          const message = 'Got a question? Email a human at info@interviewbud.com and we\'ll get back to you as soon as we can.';
          facebook.sendTextMessage(senderId, message);

          return sendCurrentQuestion(currentUser);          
        }
        if (command === 'skip' || command === 'next') {
          currentMessage.response_type = 'skip';
          const message = 'Okay, skipping that question for now.';
          facebook.sendTextMessage(senderId, message);

          return sendNewQuestion(currentUser);          
        }
        if (message.text.length < 4) {
          currentMessage.response_type = 'invalid_length';
          const message = 'Send a real answer, please :|';
          facebook.sendTextMessage(senderId, message);

          return sendCurrentQuestion(currentUser);         
        }

        // Otherwise use the sent message as the question answer.
        return answers.create({
          user: currentUser._id,
          question: currentUser.current_question._id,
          answer: message.text,
        })
        .then((answer) => {
          currentMessage.response_type = 'answered';
          logger.info(`created answer:${answer._id}`);

          return sendNewQuestion(currentUser);
        });
      }
    })
    // TODO: Send sent Messenger Message ID and store as response on our Message model.
    .then(() => {
      return messages.create(currentMessage);
    })
    .then((message) => {
      logger.debug(`created message:${message._id}`);

      return true;
    })
    .catch(error => logger.error(error));
}

/**
 * Send question stored on user.current_question.
 */
function sendCurrentQuestion(user) {
  logger.info(`sendCurrentQuestion:${user._id}`);

  const question = user.current_question;
  if (!question) {
    return sendNewQuestion(user);
  }

  return sendQuestionToUser(question, user);
}

/**
 * Generate new random question not equal to current, and send to user.
 */
function sendNewQuestion(user) {
  logger.info(`sendNewQuestion:${user._id}`);

  return questions.getRandomQuestionNotEqualTo(user.current_question)
    .then((question) => {
      // Randomly get nulls returned from aggregate query if when sending answers quickly.
      if (!question) {
        logger.error('no question returned');

        return sendNewQuestion(user);
      }
      logger.info(`got random question:${question._id}`);

      return sendQuestionToUser(question, user);
    })
    .catch(error => logger.error(error));
}

/**
 * Send an interview question using the Send API.
 */
function sendQuestionToUser(question, user) {
  logger.info(`sendQuestion question:${question._id} user:${user._id}`);

  user.current_question = question._id;

  return user.save()
    .then(() => facebook.sendGenericTemplate(user._id, 'Question', question.title))
    .catch(error => logger.error(error));
}

/**
 * Routes.
 */
router.get('/webhook', function(req, res) {
  const token = process.env.MESSENGER_VALIDATION_TOKEN;
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    logger.info('GET /webhook: Validating');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    logger.error('Failed validation. Make sure the validation tokens match.');
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
