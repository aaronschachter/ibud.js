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
 * Returns a random question.
 * TODO: Pass parameter to avoid repeat questions.
 */
questionSchema.statics.getRandom = function () {
  return this.aggregate([ { $sample: { size: 1 } } ])
    .exec()
    .then(results => results[0])
    .catch(error => console.log(error));
}

/**
 * Exports.
 */
module.exports = mongoose.model('questions', questionSchema);
