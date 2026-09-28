const mongoose = require('mongoose');
const { Schema } = mongoose;

// The existing single-document role map: { reporter: "1", editor: "2" }. Users.userType holds one of the values.
const userTypeSchema = new Schema({
  reporter: Schema.Types.Mixed,
  editor: Schema.Types.Mixed
}, { collection: 'User_type', versionKey: false, strict: false });

module.exports = mongoose.model('UserType', userTypeSchema);
