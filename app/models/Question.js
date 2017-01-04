'use strict';

/**
 * Imports.
 */
const mongoose = require('mongoose');
const Promise = require('bluebird');
const logger = require('winston');

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
  if (excludeQuestion && excludeQuestion._id) {
    query.push({ $match: { _id: { $ne: excludeQuestion._id } } });
  }

  return this.aggregate(query)
    .exec()
    .then(results => results[0])
    .catch(error => logger.error(error));
}

/**
 * Exports.
 */
module.exports = mongoose.model('questions', questionSchema);
