const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

test('GPS weather uses browser coordinates and handles location/API failures', async t => {
    const { ArticleModel } = await import(pathToFileURL(require.resolve('../article/model.js')).href);
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
    t.after(() => {
        if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
        else delete globalThis.navigator;
        globalThis.fetch = originalFetch;
        console.error = originalError;
    });
    console.error = () => {};
    const model = new ArticleModel();
    const gps = { geolocation: { getCurrentPosition(resolve) {
        resolve({ coords: { latitude: 31.878, longitude: 34.739 } });
    } } };

    await t.test('success', async () => {
        setNavigator(gps);
        globalThis.fetch = async url => {
            const parsed = new URL(url);
            assert.equal(parsed.protocol, 'https:');
            assert.equal(parsed.searchParams.get('lat'), '31.878');
            assert.equal(parsed.searchParams.get('lon'), '34.739');
            return { ok: true, json: async () => ({ name: 'Yavne', main: { temp: 24.4 }, weather: [{ description: 'clear', icon: '01d' }] }) };
        };
        const result = await model.fetchWeather();
        assert.equal(result.location, '👤 Yavne');
        assert.equal(result.currentTemp, '24°');
        assert.equal(result.icon, '☀️');
    });
    await t.test('permission denied or unsupported browser', async () => {
        globalThis.fetch = async () => assert.fail('No request should be made without coordinates');
        setNavigator({ geolocation: { getCurrentPosition(resolve, reject) { reject(new Error('Permission denied')); } } });
        assert.deepEqual(await model.fetchWeather(), model.mockWeatherData);
        setNavigator({});
        assert.deepEqual(await model.fetchWeather(), model.mockWeatherData);
    });
    await t.test('weather service failure', async () => {
        setNavigator(gps);
        globalThis.fetch = async () => ({ ok: false });
        assert.deepEqual(await model.fetchWeather(), model.mockWeatherData);
    });
});
