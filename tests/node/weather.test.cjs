const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = file => import(pathToFileURL(require.resolve(file)).href);
const answer = { name: 'Yavne', main: { temp: 24.4 }, weather: [{ description: 'שמיים בהירים', icon: '01d' }] };
const rishonLeZion = [['lat', '32'], ['lon', '34.8']];

// Renders data with the real view into stand-ins for the widget's four elements and returns what they show.
async function renderWidget(data) {
    const { ArticleView } = await load('../../client/article/view.js');
    const widget = { '.weather-location': {}, '.temperature': {}, '.condition': {}, '.weather-icon': {} };
    globalThis.document = { querySelector: selector => widget[selector] || null };
    try {
        const view = new ArticleView();
        view.setWeatherLoading(true);
        view.renderWeatherData(data);
    } finally { delete globalThis.document; }
    return Object.values(widget).map(element => element.textContent);
}

test('article weather comes from the site\'s own /api/weather for the reader\'s location', async t => {
    const { ArticleModel } = await load('../../client/article/model.js');
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalFetch = globalThis.fetch;
    t.after(() => {
        if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
        else delete globalThis.navigator;
        globalThis.fetch = originalFetch;
    });
    t.mock.method(console, 'error', () => {});
    const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
    const withGeolocation = getCurrentPosition => setNavigator({ geolocation: { getCurrentPosition } });
    const inYavne = () => withGeolocation(found => found({ coords: { latitude: 31.878, longitude: 34.739 } }));
    // Answers the model's requests the way the site's /api/weather would, and records them.
    function serve(status = 200, body = answer) {
        const requests = [];
        globalThis.fetch = async url => {
            requests.push({ url });
            return { ok: status >= 200 && status < 300, status, json: async () => body };
        };
        return requests;
    }
    const query = request => [...new URL(request.url, 'http://site.test').searchParams];

    await t.test('success: the browser\'s coordinates go to the same-origin /api/weather, with no key', async () => {
        inYavne();
        const requests = serve();
        const weather = await new ArticleModel().fetchWeather();
        assert.equal(requests.length, 1);
        assert.match(requests[0].url, /^\/api\/weather\?/);
        assert.doesNotMatch(requests[0].url, /appid/i);
        assert.deepEqual(query(requests[0]), [['lat', '31.9'], ['lon', '34.7']]); // rounded before it leaves the browser
        assert.deepEqual(await renderWidget(weather), ['👤 Yavne', '24°', 'שמיים בהירים', '☀️']);
    });
    await t.test('permission denied: Rishon LeZion', async () => {
        withGeolocation((found, failed) => failed({ code: 1, message: 'User denied Geolocation' }));
        const requests = serve();
        const weather = await new ArticleModel().fetchWeather();
        assert.equal(requests.length, 1);
        assert.deepEqual(query(requests[0]), rishonLeZion);
        assert.deepEqual([weather.location, weather.currentTemp], ['👤 ראשון לציון', '24°']);
    });
    await t.test('a browser without geolocation: Rishon LeZion', async () => {
        for (const navigator of [{}, undefined]) {
            setNavigator(navigator);
            const requests = serve();
            const weather = await new ArticleModel().fetchWeather();
            assert.equal(requests.length, 1);
            assert.deepEqual(query(requests[0]), rishonLeZion);
            assert.deepEqual([weather.location, weather.currentTemp], ['👤 ראשון לציון', '24°']);
        }
    });
    await t.test('a permission prompt nobody answers: Rishon LeZion after locationTimeoutMs', { timeout: 5000 }, async () => {
        withGeolocation(() => {}); // neither callback ever runs
        const requests = serve();
        const model = new ArticleModel();
        assert.equal(model.locationTimeoutMs, 8000);
        model.locationTimeoutMs = 50;
        const pending = model.fetchWeather();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(requests.length, 0, 'still waiting for an answer to the prompt');
        const weather = await pending;
        assert.equal(requests.length, 1);
        assert.deepEqual(query(requests[0]), rishonLeZion);
        assert.equal(weather.location, '👤 ראשון לציון');
    });
    await t.test('a server error shows the failure state, with no temperature and no sun', async () => {
        inYavne();
        const model = new ArticleModel();
        const failures = {
            'server error': () => serve(502, { error: 'לא ניתן להשלים את הפעולה. נסו שוב.' }),
            'service not configured': () => serve(503, { error: 'שירות מזג האוויר אינו מוגדר.' }),
            'network error': () => { globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); }; },
            'not JSON': () => { globalThis.fetch = async () => ({
                ok: false, status: 404, json: async () => { throw new SyntaxError('Unexpected token <'); }
            }); }
        };
        for (const [failure, arrange] of Object.entries(failures)) {
            arrange();
            assert.deepEqual(await model.fetchWeather(), model.mockWeatherData, failure);
        }
        const shown = Object.values(model.mockWeatherData).join(' ');
        assert.equal(shown.includes('0°'), false);
        assert.equal(shown.includes('☀️'), false);
        assert.doesNotMatch(shown, /°|\d/, 'no temperature at all');
        assert.deepEqual(await renderWidget(model.mockWeatherData), Object.values(model.mockWeatherData));
    });
});

test('the controller shows the failure state if fetching the weather rejects', async () => {
    const { ArticleController } = await load('../../client/article/controller.js');
    const { ArticleModel } = await load('../../client/article/model.js');
    const failureState = new ArticleModel().mockWeatherData;
    const rendered = [];
    const model = {
        mockWeatherData: failureState,
        async loadArticle() { return { id: 'a' }; },
        async loadRelatedPosts() { return []; },
        async loadComments() { return []; },
        async loadUser() { return null; },
        async fetchWeather() { throw new Error('Unexpected failure'); },
        repository: { async recordView() {} }
    };
    const view = {
        renderArticle() {}, setCommentsLoading() {}, bindCommentSubmit() {}, bindCommentActions() {},
        renderRelatedPosts() {}, renderComments() {}, setCommentUser() {}, setWeatherLoading() {},
        renderWeatherData(data) { rendered.push(data); }
    };
    const previousWindow = globalThis.window;
    globalThis.window = { location: { search: '?id=a' } };
    try {
        const controller = new ArticleController(model, view);
        await controller.ready;
        await controller.secondaryReady;
        assert.deepEqual(rendered, [failureState]);
    } finally { globalThis.window = previousWindow; }
});

test('browser code holds no OpenWeatherMap URL or key', () => {
    const clientDir = path.join(__dirname, '..', '..', 'client');
    const files = fs.readdirSync(clientDir, { recursive: true }).filter(file => file.endsWith('.js'));
    assert.ok(files.includes(path.join('article', 'model.js')));
    for (const file of files) {
        const source = fs.readFileSync(path.join(clientDir, file), 'utf8');
        // Plain true/false checks, so a failure names the file without printing what matched.
        assert.equal(/openweathermap/i.test(source), false, file + ' calls OpenWeatherMap itself');
        assert.equal(/appid|weatherApiKey/i.test(source), false, file + ' refers to a weather API key');
        assert.equal(/\b[0-9a-f]{32}\b/i.test(source), false, file + ' contains a string shaped like an API key');
    }
});
