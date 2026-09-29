const mongoose = require('mongoose');
const { Schema } = mongoose;

// A copy of one Updates version with the fallbacks the site has always applied already resolved (a version
// without a title, category or image uses the article's own; one without a summary uses the start of its
// content). Dates keep the stored ISO strings; sortDate is the same moment as a real date, for sorting.
const versionSummarySchema = new Schema({
  versionId: Schema.Types.Mixed, // _id of the Updates document, used to load its content
  updateId: String,
  version: Number,
  status: String,
  title: String,
  summary: String,
  categoryId: Schema.Types.Mixed,
  mainImage: String,
  editorNote: String,
  updatedAt: Schema.Types.Mixed,
  publishedAt: Schema.Types.Mixed,
  date: Schema.Types.Mixed, // the date the site shows: publication date for readers, last change for management
  sortDate: Date
}, { _id: false });

// One document per article. title, categoryId and mainImage are the article's original values; its versions
// live in Updates. published (the version readers see), current (the latest version, any status) and
// viewCount are stored copies kept up to date by the services (see services/derivedDataService.js), so the
// feed and the management list are single indexed queries instead of a join per article.
const articleSchema = new Schema({
  articleId: { type: String, required: true },
  title: String,
  reporterIdNumber: String,
  categoryId: Schema.Types.Mixed,
  mainImage: String,
  createdAt: String,
  published: { type: versionSummarySchema, default: null },
  current: { type: versionSummarySchema, default: null },
  viewCount: { type: Number, default: 0 }
}, { collection: 'Articles', versionKey: false });

articleSchema.index({ articleId: 1 }, { unique: true });
articleSchema.index({ 'published.sortDate': -1, articleId: 1 }); // feed, newest first
articleSchema.index({ viewCount: -1, articleId: 1 }); // feed, most viewed first
articleSchema.index({ 'current.sortDate': -1, articleId: 1 }); // management list (editor)
articleSchema.index({ reporterIdNumber: 1, 'current.sortDate': -1 }); // management list (reporter)

module.exports = mongoose.model('Article', articleSchema);
