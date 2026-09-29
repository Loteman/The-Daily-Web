// The Mongoose models (the "Model" of the server's MVC). Each maps to an existing collection name.
const models = {
  User: require('./User'),
  UserType: require('./UserType'),
  Category: require('./Category'),
  Article: require('./Article'),
  Update: require('./Update'),
  Comment: require('./Comment'),
  View: require('./View'),
  Statistic: require('./Statistic')
};

// Creates any index a schema declares that the database doesn't have yet. Existing indexes are never changed or
// dropped. A failure (for example duplicate values under a unique index) is reported and the rest continue, so
// the site still starts.
async function createIndexes(report = console.error) {
  const failures = [];
  for (const model of Object.values(models)) {
    for (const [fields, options] of model.schema.indexes()) {
      try {
        await model.collection.createIndex(fields, options);
      } catch (error) {
        failures.push({ collection: model.collection.collectionName, fields, error: error.message });
        report(`Could not create index ${JSON.stringify(fields)} on ${model.collection.collectionName}: ${error.message}`);
      }
    }
  }
  return failures;
}

module.exports = { ...models, createIndexes };
