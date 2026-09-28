const mongoose = require('mongoose');
const { Schema } = mongoose;

// Hourly view totals, kept in the existing (previously empty) Statistics collection: one document per article and
// hour, plus one per hour with articleId null for the whole site. Each view adds one to both, so the statistics
// page reads a few totals instead of counting every view, and the editor's chart of all articles reads only the
// site's documents. hour is "YYYY-MM-DDTHH:00" in Israel time, the format the statistics page uses.
const statisticSchema = new Schema({
  articleId: { type: String, default: null },
  hour: { type: String, required: true },
  views: { type: Number, default: 0 }
}, { collection: 'Statistics', versionKey: false });

statisticSchema.index({ articleId: 1, hour: 1 }, { unique: true });

module.exports = mongoose.model('Statistic', statisticSchema);
