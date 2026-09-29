const { httpError } = require('./schemaService');

// The article page's weather widget asks this server instead of calling OpenWeatherMap from every browser, so the
// API key stays here and readers in the same area share one cached upstream answer.
const UPSTREAM = 'https://api.openweathermap.org/data/2.5/weather';
const FRESH_MS = 10 * 60 * 1000;   // a cached answer this young is served without asking upstream
const STALE_MS = 15 * 60 * 1000;   // how old a cached answer may be when upstream fails or the call cap is reached
const MAX_POINTS = 1000;
const CALLS_PER_MINUTE = 50;       // OpenWeatherMap's free plan allows 60
const TIMEOUT_MS = 5000;
const UNAVAILABLE = 'לא ניתן לטעון את מזג האוויר כרגע.';
const BUSY = 'שירות מזג האוויר עמוס כרגע. נסו שוב בעוד דקה.';

// Replaceable in tests. The clock is monotonic, so changes to the system time neither expire nor pin answers.
const defaults = { fetch: (...args) => globalThis.fetch(...args), now: () => performance.now() };
let deps = defaults;
let state = emptyState();

function emptyState() {
  // cache: 'lat,lon' -> { at, data }, oldest answer first. inFlight: 'lat,lon' -> its running upstream request.
  // calls: the times of the upstream calls made in the last minute, oldest first.
  return { cache: new Map(), inFlight: new Map(), calls: [] };
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
function coordinate(value, limit) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && NUMBER.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(number) || Math.abs(number) > limit) throw httpError(400, 'קואורדינטות המיקום אינן תקינות.');
  // One decimal is about 11 km: plenty for a weather widget, and it lets nearby readers share an answer.
  return Math.round(number * 10) / 10 || 0; // `|| 0` turns -0 into 0
}

// Resolves to { name, main: { temp }, weather: [{ description, icon }] } for the point nearest (lat, lon).
async function getWeather(lat, lon) {
  const point = { lat: coordinate(lat, 90), lon: coordinate(lon, 180) };
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) throw httpError(503, 'שירות מזג האוויר אינו מוגדר.');
  const id = point.lat + ',' + point.lon;
  const current = state;
  const cached = current.cache.get(id);
  if (cached && deps.now() - cached.at < FRESH_MS) return structuredClone(cached.data);
  let pending = current.inFlight.get(id);
  if (!pending) {
    if (!takeCall(current.calls)) return structuredClone(recent(current, id, 503, BUSY));
    pending = refresh(current, id, point, key);
  }
  return structuredClone(await pending);
}

// One upstream request per point at a time: every reader of that point who arrives meanwhile waits for it.
function refresh(current, id, point, key) {
  const pending = fetchCurrentWeather(point, key).then(data => {
    remember(current.cache, id, data);
    return data;
  }, error => {
    console.warn('Weather request failed:', describe(error));
    return recent(current, id, 502, UNAVAILABLE);
  }).finally(() => current.inFlight.delete(id));
  current.inFlight.set(id, pending);
  return pending;
}

async function fetchCurrentWeather(point, key) {
  const url = new URL(UPSTREAM);
  url.search = new URLSearchParams({ lat: point.lat, lon: point.lon, units: 'metric', lang: 'he', appid: key });
  const response = await deps.fetch(url.href, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    response.body?.cancel().catch(() => {});
    throw upstreamError('HTTP ' + response.status);
  }
  const json = await response.json();
  const weather = json?.weather?.[0];
  if (!Number.isFinite(json?.main?.temp) || !weather) throw upstreamError('unexpected response');
  const text = value => typeof value === 'string' ? value : '';
  // Only what the widget shows reaches the browser.
  return { name: text(json.name), main: { temp: json.main.temp },
    weather: [{ description: text(weather.description), icon: text(weather.icon) }] };
}

// The cached answer for a point if it is at most 15 minutes old; otherwise the given error.
function recent(current, id, status, message) {
  const cached = current.cache.get(id);
  if (cached && deps.now() - cached.at <= STALE_MS) return cached.data;
  throw httpError(status, message);
}

// A rolling one-minute window across all points: false once CALLS_PER_MINUTE calls were made in the last minute.
function takeCall(calls) {
  const time = deps.now();
  while (calls.length && time - calls[0] >= 60000) calls.shift();
  if (calls.length >= CALLS_PER_MINUTE) return false;
  calls.push(time);
  return true;
}

function remember(cache, id, data) {
  cache.delete(id); // re-adding keeps the Map ordered from the oldest answer to the newest
  cache.set(id, { at: deps.now(), data });
  if (cache.size > MAX_POINTS) cache.delete(cache.keys().next().value);
}

function upstreamError(reason) { return Object.assign(new Error(reason), { reason }); }
// Logs get only a status or an error type: the messages of fetch errors can quote the request URL, which holds the key.
function describe(error) { return error.reason || [error.name, error.cause?.code].filter(Boolean).join(' '); }

// For tests: replace the upstream fetch and/or the clock (milliseconds); called without arguments, restores both.
function configureWeather(overrides = {}) { deps = { ...defaults, ...overrides }; }
// For tests: forget the cached answers, the running requests and the per-minute call count.
function clearWeatherCache() { state = emptyState(); }

module.exports = { getWeather, configureWeather, clearWeatherCache };
