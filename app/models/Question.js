'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');

/**
 * Schema.
 */
const questionSchema = new mongoose.Schema({
  _id: { type: String, index: true },
  title: String,
  category: Number,
});

/**
 * Exports.
 */
module.exports = mongoose.model('questions', questionSchema);
