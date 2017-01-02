'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');
const interviewQuestions = require('./InterviewQuestion');

/**
 * Schema.
 */
const userSchema = new mongoose.Schema({
    _id: { type: String, index: true },
    current_interview_question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'interview_questions',
    },
    last_message_received: String,
    last_message_received_at: Date,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  });

/**
 * Creates and returns an InterviewQuestion model, sets as User's current Interview Question.
 */
userSchema.methods.createInterviewQuestion = function (question) {
  const user = this;
  console.log(`createInterviewQuestion question:${question._id}`);
  console.log(user);

  return mongoose.model('interview_questions').create({
      user_id: user._id,
      question_id: question._id,
    })
    .then((interviewQuestion) => {
      console.log(`created interviewQuestion:${interviewQuestion._id}`);

      user.current_interview_question = interviewQuestion._id;
      user.save();

      return interviewQuestion;
    });
}

/**
 * Exports.
 */
module.exports = mongoose.model('users', userSchema);
