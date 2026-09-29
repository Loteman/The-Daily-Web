const mongoose = require('mongoose');
const { Schema } = mongoose;

// One document per article visit. Guests have idNumber null. Signed-in readers' read status comes from here.
const viewSchema = new Schema({
  viewId: { type: String, required: true },
  articleId: { type: String, required: true },
  idNumber: { type: String, default: null },
  viewedAt: String
}, { collection: 'Views', versionKey: false });

viewSchema.index({ articleId: 1, viewedAt: -1 });
viewSchema.index({ idNumber: 1, articleId: 1 });
viewSchema.index({ viewId: 1 });

module.exports = mongoose.model('View', viewSchema);
