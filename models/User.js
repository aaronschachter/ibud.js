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
    last_message_received: String,
    last_message_received_at: Date,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  });

module.exports = function (connection) {
  return connection.model('users', userSchema);
};
