const mongoose = require('mongoose');
const { Schema } = mongoose;

// Reader comments. The collection name's spelling ("Commnents") is the existing one and is kept on purpose.
// Guests have idNumber null.
const commentSchema = new Schema({
  commentId: { type: String, required: true },
  articleId: { type: String, required: true },
  idNumber: { type: String, default: null },
  fullName: String,
  content: String,
  createdAt: String,
  editedAt: String
}, { collection: 'Commnents', versionKey: false });

commentSchema.index({ articleId: 1, createdAt: -1 });
commentSchema.index({ commentId: 1 }, { unique: true }); 
module.exports = mongoose.model('Comment', commentSchema);
