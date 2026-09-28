const mongoose = require('mongoose');
const { Schema } = mongoose;

// The existing single-document category map, e.g. { Food: 1, Politics: 2, Travel: 3 }: each key is a category
// name and each value its id. The names are data, so the schema is open (strict: false) instead of listing them.
const categorySchema = new Schema({}, { collection: 'Categories', versionKey: false, strict: false });

module.exports = mongoose.model('Category', categorySchema);
