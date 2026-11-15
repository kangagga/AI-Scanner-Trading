'use strict';
/**
 * SQLite access layer built on node:sqlite (built into Node 22, no native build step).
 * The database file lives in ./data and is created + migrated on first boot.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('../config');

let db = null;

function open() {
  if (db) return db;

  const file = config.db.file;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}

function handle() {
  return db || open();
}

/** Run a statement, returning { changes, lastInsertRowid }. */
function run(sql, params = []) {
  const stmt = handle().prepare(sql);
  return stmt.run(...normalize(params));
}

/** All rows. */
function all(sql, params = []) {
  const stmt = handle().prepare(sql);
  return stmt.all(...normalize(params));
}

/** First row or undefined. */
function get(sql, params = []) {
  const stmt = handle().prepare(sql);
  return stmt.get(...normalize(params));
}

/** Single scalar value from the first column of the first row. */
function scalar(sql, params = []) {
  const row = get(sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}

/**
 * node:sqlite rejects `undefined` and booleans. Coerce once, centrally, so call
 * sites can pass plain JS objects without defensive casts everywhere.
 */
function normalize(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'object') return JSON.stringify(p);
    return p;
  });
}

/** Wrap a function in a transaction. */
function tx(fn) {
  const h = handle();
  h.exec('BEGIN');
  try {
    const result = fn();
    h.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      h.exec('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    throw err;
  }
}

function close() {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

/** Consistent online backup (safe while the engine is running). */
async function backupTo(targetPath) {
  const { backup } = require('node:sqlite');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await backup(handle(), targetPath);
  return targetPath;
}

module.exports = { open, close, run, all, get, scalar, tx, backupTo, handle };
