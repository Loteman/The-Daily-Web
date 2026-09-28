const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const weather = require('../../server/services/weatherService');

const KEY = 'test-weather-key';
const MINUTE = 60 * 1000;
const UNAVAILABLE = 'לא ניתן לטעון את מזג האוויר כרגע.';
// An OpenWeatherMap answer; only the name, the temperature and the first description and icon may reach the browser.
const upstreamAnswer = {
    coord: { lon: 34.7, lat: 31.9 }, weather: [{ id: 800, main: 'Clear', description: 'שמיים בהירים', icon: '01d' }],
    base: 'stations', main: { temp: 24.4, feels_like: 24.1, temp_min: 23, temp_max: 25.6, pressure: 1012, humidity: 48 },
    visibility: 10000, wind: { speed: 4.1, deg: 290 }, clouds: { all: 0 }, dt: 1790000000,
    sys: { country: 'IL', sunrise: 1789970000, sunset: 1790013000 }, timezone: 10800, id: 295530, name: 'Yavne', cod: 200
};
const trimmed = { name: 'Yavne', main: { temp: 24.4 }, weather: [{ description: 'שמיים בהירים', icon: '01d' }] };
const ok = body => ({ ok: true, status: 200, json: async () => body });
const failing = status => () => ({ ok: false, status, json: async () => ({ cod: status }) });

// A fresh service with a fake OpenWeatherMap and a hand-driven clock: nothing in this file reaches the network.
function setup(t, key = KEY) {
    const originalKey = process.env.OPENWEATHER_API_KEY;
    if (key === null) delete process.env.OPENWEATHER_API_KEY;
    else process.env.OPENWEATHER_API_KEY = key;
    const upstream = { calls: [], reply: () => ok(upstreamAnswer) };
    const clock = { time: 1234567 }; // not on a minute boundary
    weather.clearWeatherCache();
    weather.configureWeather({
        fetch: async (url, options) => {
            upstream.calls.push({ url: new URL(url), signal: options.signal });
            return upstream.reply(url, options);
        },
        now: () => clock.time
    });
    const warnings = t.mock.method(console, 'warn', () => {});
    t.after(() => {
        weather.configureWeather();
        weather.clearWeatherCache();
        if (originalKey === undefined) delete process.env.OPENWEATHER_API_KEY;
        else process.env.OPENWEATHER_API_KEY = originalKey;
    });
    return { upstream, clock, warnings };
}

// The router on a bare app whose error handler, like the site's, answers { error } with the error's status.
async function serveRouter(t) {
    const app = express();
    app.use('/api/weather', require('../../server/routes/api/weatherApi'));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    return async query => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/weather${query}`);
        return { status: response.status, body: await response.json() };
    };
}

test('without OPENWEATHER_API_KEY the answer is 503 and nothing is requested', async t => {
    const { upstream } = setup(t, null);
    const get = await serveRouter(t);
    assert.deepEqual(await get('?lat=31.878&lon=34.739'), { status: 503, body: { error: 'שירות מזג האוויר אינו מוגדר.' } });
    process.env.OPENWEATHER_API_KEY = '  ';
    assert.equal((await get('?lat=31.878&lon=34.739')).status, 503);
    assert.equal(upstream.calls.length, 0);
    // The key is read on each call, so setting it later is enough.
    process.env.OPENWEATHER_API_KEY = KEY;
    assert.equal((await get('?lat=31.878&lon=34.739')).status, 200);
});

test('invalid coordinates give 400 and no upstream call', async t => {
    const { upstream } = setup(t);
    const get = await serveRouter(t);
    const invalid = ['', '?lat=31.8', '?lon=34.7', '?lat=&lon=', '?lat=abc&lon=34.7', '?lat=31.8&lon=34.7abc',
        '?lat=90.1&lon=0', '?lat=-91&lon=0', '?lat=0&lon=180.5', '?lat=0&lon=-181', '?lat=NaN&lon=0',
        '?lat=Infinity&lon=0', '?lat=1e999&lon=0', '?lat=0x1F&lon=0', '?lat=31&lat=32&lon=34'];
    for (const query of invalid) {
        assert.deepEqual(await get(query), { status: 400, body: { error: 'קואורדינטות המיקום אינן תקינות.' } }, query);
    }
    await assert.rejects(weather.getWeather(Number.NaN, 0), { status: 400 });
    await assert.rejects(weather.getWeather(null, 0), { status: 400 });
    assert.equal(upstream.calls.length, 0);
    // The ends of the ranges are valid.
    assert.equal((await get('?lat=-90&lon=180')).status, 200);
    assert.equal((await get('?lat=90&lon=-180')).status, 200);
});

test('success returns only name, temperature, description and icon, asking upstream for the rounded point', async t => {
    const { upstream } = setup(t);
    const get = await serveRouter(t);
    assert.deepEqual(await get('?lat=31.878&lon=34.739'), { status: 200, body: trimmed });
    assert.equal(upstream.calls.length, 1);
    const { url, signal } = upstream.calls[0];
    assert.equal(url.origin + url.pathname, 'https://api.openweathermap.org/data/2.5/weather');
    assert.deepEqual(Object.fromEntries(url.searchParams), { lat: '31.9', lon: '34.7', units: 'metric', lang: 'he', appid: KEY });
    assert.ok(signal instanceof AbortSignal);
    await weather.getWeather('-33.86', -0.04);
    assert.deepEqual([upstream.calls[1].url.searchParams.get('lat'), upstream.calls[1].url.searchParams.get('lon')], ['-33.9', '0']);
});

test('a point is served from the cache for 10 minutes, also to readers nearby', async t => {
    const { upstream, clock } = setup(t);
    const first = await weather.getWeather(31.878, 34.739);
    clock.time += 10 * MINUTE - 1;
    const fromCache = await weather.getWeather(31.878, 34.739);
    assert.deepEqual(fromCache, trimmed);
    first.main.temp = fromCache.main.temp = -40; // callers get copies, so this can't change the cache
    assert.deepEqual(await weather.getWeather('31.91', '34.66'), trimmed); // rounds to the same point
    assert.equal(upstream.calls.length, 1);
    clock.time += 1;
    assert.deepEqual(await weather.getWeather(31.878, 34.739), trimmed);
    assert.equal(upstream.calls.length, 2);
    await weather.getWeather(32.08, 34.78);
    assert.equal(upstream.calls.length, 3);
});

test('20 simultaneous requests for one point share one upstream call, whether it succeeds or fails', async t => {
    const { upstream } = setup(t);
    let settle;
    upstream.reply = () => new Promise((resolve, reject) => { settle = { resolve, reject }; });
    const readers = Array.from({ length: 20 }, (_, i) => weather.getWeather((31.88 + (i % 5) / 100).toFixed(2), 34.739));
    assert.equal(upstream.calls.length, 1);
    settle.resolve(ok(upstreamAnswer));
    const answers = await Promise.all(readers);
    assert.equal(upstream.calls.length, 1);
    answers.forEach(answer => assert.deepEqual(answer, trimmed));

    const unlucky = Array.from({ length: 20 }, () => weather.getWeather(29.557, 34.952));
    assert.equal(upstream.calls.length, 2);
    settle.reject(new TypeError('fetch failed'));
    for (const outcome of await Promise.allSettled(unlucky)) {
        assert.equal(outcome.status, 'rejected');
        assert.equal(outcome.reason.status, 502);
    }
    assert.equal(upstream.calls.length, 2);
});

test('when upstream fails, a cached answer up to 30 minutes old is served, after that 502', async t => {
    const { upstream, clock } = setup(t);
    const get = await serveRouter(t);
    const yavne = '?lat=31.878&lon=34.739';
    assert.equal((await get(yavne)).status, 200);
    upstream.reply = failing(500);
    clock.time += 10 * MINUTE;
    assert.deepEqual(await get(yavne), { status: 200, body: trimmed });
    clock.time += 20 * MINUTE; // exactly 30 minutes old
    assert.deepEqual(await get(yavne), { status: 200, body: trimmed });
    clock.time += 1;
    assert.deepEqual(await get(yavne), { status: 502, body: { error: UNAVAILABLE } });
    assert.equal(upstream.calls.length, 4); // each of those asked upstream again: failures aren't cached
});

test('network errors, non-2xx answers and bad JSON are failures, logged without the key or URL', async t => {
    const { upstream, warnings } = setup(t);
    const failures = {
        // fetch errors can quote the request URL (and so the key); that must not reach the log.
        'network error': url => Promise.reject(new TypeError('fetch failed: ' + url,
            { cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) })),
        'invalid key': failing(401),
        'upstream quota': failing(429),
        'bad JSON': () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
        'unexpected JSON': () => ok({ cod: 200, main: {}, weather: [] }),
        'temperature as text': () => ok({ ...upstreamAnswer, main: { temp: '24' } })
    };
    for (const [failure, reply] of Object.entries(failures)) {
        upstream.reply = reply;
        await assert.rejects(weather.getWeather(31.878, 34.739), { status: 502, message: UNAVAILABLE }, failure);
    }
    assert.equal(upstream.calls.length, 6);
    const logged = warnings.mock.calls.map(call => call.arguments.join(' ')).join('\n');
    assert.match(logged, /TypeError ENOTFOUND/);
    assert.match(logged, /HTTP 401/);
    assert.equal(logged.includes(KEY) || /openweathermap|appid/i.test(logged), false, 'the log holds the key or the URL');
});

test('a timeout counts as a failure', async t => {
    const { upstream, clock } = setup(t);
    await weather.getWeather(31.878, 34.739);
    // Stand in for AbortSignal.timeout(5000) with a signal the test aborts, so nobody waits 5 seconds.
    const timeouts = [];
    let controller;
    t.mock.method(AbortSignal, 'timeout', ms => {
        timeouts.push(ms);
        controller = new AbortController();
        return controller.signal;
    });
    const timeOut = () => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    // Like fetch, the fake upstream never answers by itself and gives up when its signal aborts.
    upstream.reply = (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
    });
    clock.time += 11 * MINUTE;
    const cached = weather.getWeather(31.878, 34.739);
    assert.equal(upstream.calls.at(-1).signal, controller.signal);
    timeOut();
    assert.deepEqual(await cached, trimmed);
    const uncached = weather.getWeather(29.557, 34.952);
    timeOut();
    await assert.rejects(uncached, { status: 502, message: UNAVAILABLE });
    assert.deepEqual(timeouts, [5000, 5000]);
});

test('at most 50 upstream calls per rolling minute; over that, a cached answer or 503', async t => {
    const { upstream, clock } = setup(t);
    const get = await serveRouter(t);
    await weather.getWeather(31.878, 34.739);
    clock.time += 11 * MINUTE; // Yavne's answer is no longer fresh but still usable
    for (let i = 0; i < 50; i++) await weather.getWeather(i / 10, 10);
    assert.equal(upstream.calls.length, 51);
    // This minute's calls are used up: Yavne gets its cached answer, a point with nothing cached gets 503.
    assert.deepEqual(await weather.getWeather(31.878, 34.739), trimmed);
    const busy = { status: 503, body: { error: 'שירות מזג האוויר עמוס כרגע. נסו שוב בעוד דקה.' } };
    assert.deepEqual(await get('?lat=-33.9&lon=151.2'), busy);
    clock.time += MINUTE - 1;
    assert.deepEqual(await get('?lat=-33.9&lon=151.2'), busy);
    assert.equal(upstream.calls.length, 51);
    // A minute after those 50 calls, calling is allowed again.
    clock.time += 1;
    assert.deepEqual(await get('?lat=-33.9&lon=151.2'), { status: 200, body: trimmed });
    assert.equal(upstream.calls.length, 52);
});

test('at most 1,000 points are kept, dropping the oldest', async t => {
    const { upstream, clock } = setup(t);
    for (let i = 0; i <= 1000; i++) {
        if (i && i % 50 === 0) clock.time += MINUTE; // stay under the call cap
        await weather.getWeather((i / 10 - 50).toFixed(1), 0);
    }
    assert.equal(upstream.calls.length, 1001);
    upstream.reply = failing(500);
    clock.time += MINUTE;
    await assert.rejects(weather.getWeather('-50.0', 0), { status: 502 }); // the oldest point was dropped
    assert.deepEqual(await weather.getWeather('-49.9', 0), trimmed); // the next oldest (21 minutes) is still cached
});
