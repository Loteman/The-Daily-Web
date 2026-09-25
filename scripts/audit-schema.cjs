require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
(async () => {
    try {
        await require('../config/db')();
        const db = mongoose.connection.db;
        for (const name of ['Articles', 'Updates', 'Users', 'User_type', 'Categories', 'Commnents', 'Views', 'Statistics']) {
            const rows = await db.collection(name).find({}).toArray();
            console.log(name + ': ' + JSON.stringify({ count: rows.length, fields: [...new Set(rows.flatMap(row => Object.keys(row)))] }));
            if (name === 'Users') for (const user of rows) {
                console.log(JSON.stringify({ username: user.username,
                    validBcryptFormat: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.passwordHash) }));
            }
        }
    } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.name, error.code || ''); process.exitCode = 1; });
