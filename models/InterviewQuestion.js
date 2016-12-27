'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');

/**
 * Schema.
 */
const interviewQuestionSchema = new mongoose.Schema({
  user_id: String,
  question_id: Number,
  answered: Boolean,
  answer: String,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  });

module.exports = function (connection) {
  return connection.model('interview_questions', interviewQuestionSchema);
};