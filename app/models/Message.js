'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');

/**
 * Schema.
 */
const messageSchema = new mongoose.Schema({
  _id: {
    type: String,
    index: true,
  },
  user: {
    type: String,
    ref: 'users',
    index: true,
  },
  timestamp: Number,
  current_question: String,
  text: String,
  attachments: Object,
  response_type: String,
});

/**
 * Exports.
 */
module.exports = mongoose.model('messages', messageSchema);
