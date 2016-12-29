'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const request = require('request');

const mongoose = require('mongoose');
const DB_URI = process.env.DB_URI || 'mongodb://localhost/interviewbud';
mongoose.Promise = global.Promise;
mongoose.connect(DB_URI);
const db = mongoose.connection;
db.once('open', () => {
  console.log('db connected');
});

const interviewQuestions = require('./models/InterviewQuestion');
const users = require('./models/User');

const app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({ verify: verifyRequestSignature }));

const fbUri = 'https://graph.facebook.com/v2.6/me';
const APP_SECRET = process.env.MESSENGER_APP_SECRET;
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

/**
 * Routes.
 */
app.get('/webhook', function(req, res) {
  console.log(req.hub);
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
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

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 */
function callSendAPI(messageData) {
  request({
    uri: `${fbUri}/messages`,
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData,
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

function getQuestion() {
  const index = Math.floor(Math.random() * (app.locals.questions.length));
  return app.locals.questions[index];
}

function receivedMessage(event) {
  console.log('event');
  console.log(event);

  let currentInterviewQuestion;
  let currentUser;
  let responseText;
  const senderId = event.sender.id;
  const message = event.message;
  const postback = event.postback;

  if (postback && postback.payload === 'new_user') {
    console.log(`new_user:${senderId}`);

    return users.findByIdAndUpdate(senderId, { }, {
        new: true,
        upsert: true, 
      })
      .then((user) => {
        console.log(`created new user:${senderId}`);

        return sendInterviewQuestion(user);
      })
      .catch(error => console.log(error));
  }

  users.findById(senderId)
    .populate('current_interview_question')
    .exec()
    .then((user) => {
      if (!(user)) {
        // TODO: Safety check: new user should already have been created.
        return;
      }
      console.log(user.current_interview_question);

      currentUser = user;
      currentInterviewQuestion = currentUser.current_interview_question;

      // Safety check for current interview question, if not set, send one.
      if (!currentInterviewQuestion) {
        return sendInterviewQuestion(currentUser);
      }

      if (message.attachments) {
        responseText = 'Sorry, you can\'t answer an interview question with an attachment. If only.';
        return sendTextMessage(senderId, responseText); 
      }

      if (message.text) {
        // TODO: Check if it's a command check if it's a command like Help, Hello, Quit, Who is this?
        currentUser.last_message_received = message.text;
        currentInterviewQuestion.save();
        currentInterviewQuestion.answered = true;
        currentInterviewQuestion.answer = message.text;

        return sendInterviewQuestion(currentUser, true);
       }
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

  callSendAPI(messageData);
}

/**
 * Returns payload for a Interview Question message with I Don't Know button.
 */
function formatInterviewQuestionPayload(userId, questionTitle) {
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
            title: 'Next question:',
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
  console.log(user);
  console.log(`sendInterviewQuestion user:${user._id}`);
  const question = getQuestion();

  return user.createInterviewQuestion(question)
    .then((interviewQuestion) => {
      console.log(`createInterviewQuestion:${interviewQuestion._id}`);

      const payload = formatInterviewQuestionPayload(user._id, question.question_title);
      console.log(payload);

      return callSendAPI(payload);
    })
    .catch(error => console.log(error));
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.locals.questions = [];

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
        app.locals.questions.push(question);
      }
    });

    console.log(`Loaded ${app.locals.questions.length} questions.`);
    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  }
});

/**
 * Set Welcome greeting.
 */
request({
  method: 'POST',
  uri: `${fbUri}/thread_settings`,
  qs: { access_token : process.env.MESSENGER_PAGE_ACCESS_TOKEN },
  json: {
    setting_type: 'greeting',
    greeting: {
      text: 'Hey {{user_first_name}}, I\'m Interviewbud, a bot that asks you job interview questions.\n\nI don\'t know whether your answers are good, I\'m just a bot -- here to help you practice for upcoming interviews.',
    },
  },
});

/**
 * Set Get Started button.
 */
request({
  method: 'POST',
  uri: `${fbUri}/thread_settings`,
  qs: { access_token : process.env.MESSENGER_PAGE_ACCESS_TOKEN },
  json: {
    setting_type: 'call_to_actions',
    thread_state: 'new_thread',
    call_to_actions: [{
      payload: 'new_user',
    }],
  },
});


module.exports = app;
