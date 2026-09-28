const router = require('express').Router();
const { getWeather } = require('../../services/weatherService');

// GET ?lat=..&lon=.. : the current weather near the reader, fetched and cached by the server so the
// OpenWeatherMap key never reaches the browser.
router.get('/', async (req, res) => {
  res.json(await getWeather(req.query.lat, req.query.lon));
});
module.exports = router;
