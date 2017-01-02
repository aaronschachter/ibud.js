'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');

/**
 * Schema.
 */
const userSchema = new mongoose.Schema({
    _id: { type: String, index: true },
    current_question: {
      type: Number,
      ref: 'questions',
    },
    last_message_received: String,
    last_message_received_at: Date,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  }
);

/**
 * Exports.
 */
module.exports = mongoose.model('users', userSchema);
