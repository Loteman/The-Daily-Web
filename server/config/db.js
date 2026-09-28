const mongoose = require('mongoose');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createIndexes } = require('../models');
const { ensureDerivedData } = require('../services/derivedDataService');
const { logError } = require('../utils/logger');

// Fall back to Windows DNS when the local network refuses Node's SRV lookup.
async function resolveWithWindows(uri) {
  const parsed = new URL(uri);
  const hostname = parsed.hostname;
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) throw new Error('Invalid MongoDB hostname');
  const script = `$ErrorActionPreference = 'Stop'; $srv = @(Resolve-DnsName -Name '_mongodb._tcp.${hostname}' -Type SRV | Where-Object { $_.Type -eq 'SRV' } | Select-Object NameTarget,Port); $txt = @(Resolve-DnsName -Name '${hostname}' -Type TXT | Where-Object { $_.Type -eq 'TXT' } | ForEach-Object { $_.Strings -join '' }); @{srv=$srv;txt=$txt} | ConvertTo-Json -Compress`;
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000 });
  const records = JSON.parse(stdout);
  if (!records.srv.length) throw new Error('MongoDB DNS returned no servers');
  const options = new URLSearchParams(records.txt.join('&'));
  for (const [key, value] of parsed.searchParams) options.set(key, value);
  if (!options.has('tls')) options.set('tls', 'true');
  const credentials = parsed.username ? `${parsed.username}:${parsed.password}@` : '';
  const hosts = records.srv.map(record => `${record.NameTarget.replace(/\.$/, '')}:${record.Port}`).join(',');
  return `mongodb://${credentials}${hosts}${parsed.pathname || '/'}?${options}`;
}

// Gets the database ready for the site: creates the indexes the models declare (only missing ones; nothing is
// dropped) and rebuilds the stored listing fields and view totals if they are missing or out of step.
async function prepareDatabase() {
  await createIndexes(message => {
    console.error(message);
    logError(new Error(message), { step: 'createIndexes' });
  });
  const rebuilt = await ensureDerivedData();
  if (rebuilt) console.log(`Rebuilt stored listing data for ${rebuilt.articles} articles and ${rebuilt.views} views.`);
}

// prepare: false only connects (for read-only tools such as npm run audit:schema).
async function connectDB({ prepare = true } = {}) {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const options = { dbName: process.env.MONGO_DB_NAME || 'main_DB', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 };
  let connection;
  try {
    connection = await mongoose.connect(uri, options);
  } catch (error) {
    if (process.platform !== 'win32' || !uri.startsWith('mongodb+srv://') || error.code !== 'ECONNREFUSED' || !['querySrv', 'queryTxt'].includes(error.syscall)) throw error;
    await mongoose.disconnect();
    connection = await mongoose.connect(await resolveWithWindows(uri), options);
  }
  if (prepare) await prepareDatabase();
  return connection;
}

module.exports = connectDB;
module.exports.prepareDatabase = prepareDatabase;
