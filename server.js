'use strict'

/**
 * Express.
 */
const express = require('express');
const app = express();
app.set('port', process.env.PORT || 5000);

const bodyParser = require('body-parser');
const facebook = require('./lib/messenger');
app.use(bodyParser.json({ verify: facebook.verifyRequestSignature }));

const logger = require('winston');

/**
 * Check for required config.
 */
const APP_SECRET = process.env.MESSENGER_APP_SECRET;
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const debug = false;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  logger.error('Missing config values');
  process.exit(1);
}

/**
 * Database.
 */
const mongoose = require('mongoose');
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost/interviewbud';
mongoose.Promise = global.Promise;
mongoose.connect(DB_URI);
const db = mongoose.connection;
db.once('open', () => {
  logger.info('db connected');
});

/**
 * Routes.
 */
const router = require('./app/index');
app.use('/', router);

/**
 * Start server.
 */
app.listen(app.get('port'), function() {
  logger.info('Interviewbud is running on port', app.get('port'));
});

const request = require('request');

/**
 * Sync Interviewbud questions.
 */
const questions = require('./app/models/Question');
const url = `${process.env.IVB_QUESTIONS_URL}questions?filter[posts_per_page]=50`;
request(url, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    logger.debug('Loading questions...');
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
        .then(question => logger.debug(`Updated question ${question._id}`))
        .catch(error => console.log(error));
      }
    });
  }
});

/**
 * Post Messenger thread settings.
 */
const helpers = require('./lib/helpers');
const greeting =  {
  setting_type: 'greeting',
  greeting: {
    text: `Hey {{user_first_name}}, ${helpers.greetingText}`,
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
