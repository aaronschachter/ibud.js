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
 */
questionSchema.statics.getRandomQuestionNotEqualTo = function (excludeQuestion) {
  const query = [{ $sample: { size: 1 } }];
  if (excludeQuestion) {
    query.push({ $match: { _id: { $ne: excludeQuestion._id } } });
  }
  return this.aggregate(query)
    .exec()
    .then(results => results[0])
    .catch(error => console.log(error));
}

/**
 * Exports.
 */
module.exports = mongoose.model('questions', questionSchema);
