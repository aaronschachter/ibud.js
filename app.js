'use strict'

const express = require('express');
const request = require('request');

const mongoose = require('mongoose');
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost/interviewbud';
mongoose.Promise = global.Promise;
mongoose.connect(DB_URI);
const db = mongoose.connection;
db.once('open', () => {
  console.log('db connected');
});

const facebook = require('./lib/messenger');
const answers = require('./app/models/Answer');
const questions = require('./app/models/Question');
const users = require('./app/models/User');

const app = express();
app.set('port', process.env.PORT || 5000);
const bodyParser = require('body-parser');
app.use(bodyParser.json({ verify: facebook.verifyRequestSignature }));

const APP_SECRET = process.env.MESSENGER_APP_SECRET;
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const debug = false;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

const greetingText = 'I\'m Interviewbud, a bot that asks you job interview questions.\n\nI don\'t know whether your answers are good, I\'m just a bot -- here to help you practice for upcoming interviews.';

/**
 * Routes.
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
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
    sendTextMessage(senderId, greetingText);
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

        return sendInterviewQuestion(user);
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
        return sendInterviewQuestion(currentUser);
      }

      if (message.attachments) {
        responseText = 'Sorry, you can\'t answer an interview question with an attachment. If only.';
        sendTextMessage(senderId, responseText);

        return sendInterviewQuestion(currentUser);
      }

      if (message.text) {
        return answers.create({
          user: currentUser._id,
          question: currentUser.current_question._id,
          answer: message.text,
        })
        .then((answer) => {
          console.log(`created answer:${answer._id}`);

          return sendInterviewQuestion(currentUser);
        });
      }

      console.log('Did not send any response');
    })
    .catch(error => console.log(error));
}

/**
 * Send a text message using the Send API.
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
    }
  };

  facebook.postMessage(messageData);
}

/**
 * Returns payload for a Question message with I Don't Know button.
 */
function formatQuestionPayload(userId, questionTitle) {
  const messageData = {
    recipient: {
      id: userId,
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: 'Question:',
            subtitle: questionTitle,
          }],
        },
      },
    },
  };

  return messageData;
}

/**
 * Send an interview question using the Send API.
 */
function sendInterviewQuestion(user) {
  console.log(`sendInterviewQuestion user:${user._id}`);
  let currentQuestion;

  // TODO: Only getRandomQuestion if User has answered.
  return questions.getRandom()
    .then((question) => {
      currentQuestion = question;
      user.current_question = currentQuestion._id;

      return user.save();
    })
    .then(() => {
      const payload = formatQuestionPayload(user._id, currentQuestion.title);

      return facebook.postMessage(payload);
    })
    .catch(error => console.log(error));
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
const url = `${process.env.IVB_QUESTIONS_URL}questions?filter[posts_per_page]=50`;
request(url, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    console.log('Loading questions...');
    JSON.parse(body).forEach((question) => {
      const category = Number(question.categories[0]);
      // Hardcoded to only ask general questions for now.
      if (category == 1) {
        return questions.findByIdAndUpdate(question.id, 
          {
            title: question.question_title,
            category,
          }, 
          {
            new: true,
            upsert: true, 
          }
        )
        .then((question) => {
          if (debug) {
            console.log(`Updated question ${question._id}: ${question.title}`);
          }
        })
        .catch(error => console.log(error));
      }
    });

    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  }
});

/**
 * Thread settings.
 */
const greeting =  {
  setting_type: 'greeting',
  greeting: {
    text: `Hey {{user_first_name}}, ${greetingText}`,
  },
};
facebook.postThreadSettings(greeting);

const newThread = {
  setting_type: 'call_to_actions',
  thread_state: 'new_thread',
  call_to_actions: [{
    payload: 'new_user',
  }],
};
facebook.postThreadSettings(newThread);

const existingThread = {
  setting_type: 'call_to_actions',
  thread_state: 'existing_thread',
  call_to_actions: [
    {
      type: 'postback',
      title: 'About Interviewbud',
      payload: 'menu_about',
    },
    {
      type: 'web_url',
      title: 'View website',
      url: 'http://www.interviewbud.com',
    }
  ],
};
facebook.postThreadSettings(existingThread);

module.exports = app;
