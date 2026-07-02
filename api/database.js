let db = null;

try {
  const Database = require("better-sqlite3");

  db = new Database("oracle.db");

  db.pragma("journal_mode = WAL");

  db.exec(`
CREATE TABLE IF NOT EXISTS progress (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tmdbId INTEGER NOT NULL,

    type TEXT NOT NULL,

    season INTEGER DEFAULT 0,

    episode INTEGER DEFAULT 0,

    userId TEXT DEFAULT 'default',

    title TEXT,

    poster TEXT,

    provider TEXT,

    sourceUrl TEXT,

    position INTEGER DEFAULT 0,

    duration INTEGER DEFAULT 0,

    updatedAt INTEGER NOT NULL,

    UNIQUE(
      userId,
      tmdbId,
      type,
      season,
      episode
    )

);
`);

  console.log("SQLite initialized");

} catch (err) {

  console.error("SQLite disabled:", err.message);

  db = {
    prepare() {
      return {
        run() {},
        get() { return null; },
        all() { return []; }
      };
    },
    exec() {}
  };
}

module.exports = db;