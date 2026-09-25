const { startFixture } = require('./fixtures.cjs');
startFixture(3100).then(fixture => {
    console.log('Fixture website: ' + fixture.base);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.close(); process.exit(0); });
}).catch(error => { console.error(error); process.exitCode = 1; });
