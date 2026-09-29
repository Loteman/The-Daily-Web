const mongoose = require('mongoose');
const { Schema } = mongoose;

// Login accounts. userType points into User_type (reporter "1", editor "2"); the existing documents store it
// as a number and the map stores strings, so it is Mixed to keep whichever type a document already has.
const userSchema = new Schema({
  idNumber: { type: String, required: true },
  username: { type: String, required: true },
  fullName: String,
  userType: Schema.Types.Mixed,
  passwordHash: String
}, { collection: 'Users', versionKey: false });

userSchema.index({ idNumber: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
