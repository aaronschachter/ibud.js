'use strict';

const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap
const logger = require('winston');
const twilio = require('twilio');

const facebook = require('../lib/messenger');
const helpers = require('../lib/helpers');
const answers = require('./models/Answer');
const messages = require('./models/Message');
const questions = require('./models/Question');
const users = require('./models/User')

function sendTextThenCurrentQuestion(user, text) {
  logger.info('sendTextThenCurrentQuestion');

  return facebook
    .sendTextMessage(user._id, text)
    .then(() => sendCurrentQuestion(user))
    .catch(error => logger.error(error));
}

function sendTextThenNewQuestion(user, text) {
  logger.info('sendTextThenNewQuestion');

  return facebook
    .sendTextMessage(user._id, text)
    .then(() => sendNewQuestion(user))
    .catch(error => logger.error(error));
}

/**
 * Handles messages sent to our Messenger webhook.
 */
function receivedMessage(event) {
  logger.info(`received event:${JSON.stringify(event)}`);

  const senderId = event.sender.id;
  const message = event.message;
  const postback = event.postback;

  let currentMessage = { timestamp: event.timestamp };
  let currentUser;
  let updateUser = { };

  if (message) {
    const mid = message.mid;
    currentMessage.mid = mid;
    updateUser.last_sent_message = mid;
  }
  const options =  { new: true, upsert: true };

  return users
    .findByIdAndUpdate(senderId, updateUser, options)
    .populate('current_question')
    .then((user) => {
      logger.info(`loaded user:${user._id}`);
      currentUser = user;
      currentMessage.user = currentUser._id;

      if (postback && postback.payload === 'new_user') {
        logger.info(`new_user:${senderId}`);
        currentMessage.response_type = 'new_user';

        return sendNewQuestion(currentUser);
      }

      if (postback && postback.payload === 'menu_about') {
        logger.info(`menu_about:${senderId}`);
        currentMessage.response_type = 'menu_about';

        return sendTextThenCurrentQuestion(currentUser, helpers.greetingText)
      }

      if (message.attachments) {
        currentMessage.response_type = 'attachments';
        currentMessage.attachments = message.attachments;
        const text = 'Sorry, I don\'t understand, I\'m just a bot. Please send your answer as text.';

        return sendTextThenCurrentQuestion(currentUser, text);
      }

      if (message.text) {
        currentMessage.text = message.text;
        // Check if sent message is a command. 
        const command = message.text.toLowerCase();
        if (command === 'help' || command === 'question' || command === 'q') {
          currentMessage.response_type = 'help';
          const text = 'Got a question? Email a human at info@interviewbud.com and we\'ll get back to you as soon as we can. Until then, let\'s keep practicing!';

          return sendTextThenCurrentQuestion(currentUser, text);         
        }
        if (command === 'skip' || command === 'next') {
          currentMessage.response_type = 'skip';
          const text = 'Okay, skipping that question for now.';

          return sendTextThenNewQuestion(currentUser, text);          
        }
        if (message.text.length < 4) {
          currentMessage.response_type = 'invalid_length';
          const text = 'Send a real answer, please :|';

          return sendTextThenCurrentQuestion(currentUser, text);          
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
  logger.info(`sending question:${question._id} to user:${user._id}`);

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
