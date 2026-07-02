const Database = require("better-sqlite3");

// Opens oracle.db in the project folder.
// If it doesn't exist, it will be created automatically.
const db = new Database("oracle.db");

// Better performance & reliability
db.pragma("journal_mode = WAL");

// ----------------------------------------------------
// Progress / Continue Watching
// ----------------------------------------------------
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

    updatedAt INTEGER NOT NULL
    UNIQUE(
    userId,
    tmdbId,
    type,
    season,
    episode
)

);
`);

module.exports = db;