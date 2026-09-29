const router = require('express').Router();
const { getCategories } = require('../../services/schemaService');

// The category list for the feed filter and the article form: [{ name, id, className }].
router.get('/', async (req, res) => {
  try {
    res.json(await getCategories());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});
module.exports = router;
