const mongoose = require('mongoose');
const { Schema } = mongoose;

// Article versions. Status is draft, pending, published or returned; readers see the newest published version.
// _id is Mixed because older documents have ObjectIds while revisions use "<articleId>:v<version>" strings,
// whose uniqueness stops two simultaneous requests from creating the same version. Timestamps stay ISO strings,
// as in the existing documents.
const updateSchema = new Schema({
  _id: { type: Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId() },
  updateId: String,
  articleId: { type: String, required: true },
  version: { type: Number, required: true },
  title: String,
  categoryId: Schema.Types.Mixed,
  mainImage: String,
  summary: String,
  content: String,
  status: { type: String, enum: ['draft', 'pending', 'published', 'returned'] },
  editorNote: String,
  updatedAt: String,
  publishedAt: String
}, { collection: 'Updates', versionKey: false });

updateSchema.index({ articleId: 1, version: -1 });
updateSchema.index({ articleId: 1, status: 1, version: -1 });

module.exports = mongoose.model('Update', updateSchema);
