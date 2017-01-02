'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');

/**
 * Schema.
 */
const answerSchema = new mongoose.Schema({
  user: {
    type: String,
    ref: 'users',
    index: true,
  },
  question: {
    type: Number,
    ref: 'questions',
    index: true,
  },
  answer: String,
});

/**
 * Exports.
 */
module.exports = mongoose.model('answers', answerSchema);
