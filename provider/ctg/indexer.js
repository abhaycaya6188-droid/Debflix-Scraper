/* ============================================================
   CTG Index Builder
============================================================ */

const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const ROOTS = [

    "https://movie.ctgfun.com/"

];

const CACHE_DIR =
    path.join(__dirname, "cache");

const INDEX_FILE =
    path.join(CACHE_DIR, "index.json");

const STATS_FILE =
    path.join(CACHE_DIR, "stats.json");

const FOLDERS_FILE =
    path.join(CACHE_DIR, "folders.json");

const QUEUE_FILE =
    path.join(CACHE_DIR, "queue.json");

const STATE_FILE =
    path.join(CACHE_DIR, "state.json");

// ADD HERE
const INDEX_TMP_FILE =
    path.join(CACHE_DIR, "index.tmp.json");

const FOLDERS_TMP_FILE =
    path.join(CACHE_DIR, "folders.tmp.json");

const STATS_TMP_FILE =
    path.join(CACHE_DIR, "stats.tmp.json");

if (!fs.existsSync(CACHE_DIR)) {

    fs.mkdirSync(CACHE_DIR, {
        recursive: true
    });

}

let index = [];

let folders = {};
let seen = new Set();

let stats = {

    started: Date.now(),

    folders: 0,

    videos: 0

};

function saveIndex() {

    fs.writeFileSync(

        INDEX_FILE,

        JSON.stringify(index, null, 2)

    );

}

function saveFolders() {

    fs.writeFileSync(

        FOLDERS_FILE,

        JSON.stringify(folders, null, 2)

    );

}

function saveStats() {

    stats.finished = Date.now();

    stats.duration =
        stats.finished - stats.started;

    fs.writeFileSync(

        STATS_FILE,

        JSON.stringify(stats, null, 2)

    );

}

function cleanupCache() {

    const files = [

        INDEX_FILE,
        FOLDERS_FILE,
        STATS_FILE,

        INDEX_TMP_FILE,
        FOLDERS_TMP_FILE,
        STATS_TMP_FILE,

        QUEUE_FILE,
        STATE_FILE

    ];

    for (const file of files) {

        if (fs.existsSync(file)) {

            fs.unlinkSync(file);

        }

    }

}

function saveQueue(queue) {

    fs.writeFileSync(

        QUEUE_FILE,

        JSON.stringify(queue, null, 2)

    );

}

function saveState(state) {

    fs.writeFileSync(

        STATE_FILE,

        JSON.stringify(state, null, 2)

    );

}

function loadQueue() {

    if (!fs.existsSync(QUEUE_FILE))
        return null;

    try {

        return JSON.parse(

            fs.readFileSync(
                QUEUE_FILE,
                "utf8"
            )

        );

    }

    catch {

        return null;

    }

}

function loadState() {

    if (!fs.existsSync(STATE_FILE))
        return null;

    try {

        return JSON.parse(

            fs.readFileSync(
                STATE_FILE,
                "utf8"
            )

        );

    }

    catch {

        return null;

    }

}

async function visit(entry) {

    if (entry.type === "directory") {

        folders[entry.url] = {

            scanned: true,

            modified: entry.modified || null

        };

        stats.folders++;

        return;
    }

    if (entry.type !== "video")
        return;

    const meta = parser.parse(

    entry.name,

    entry.path

);



    if (!parser.validate(meta))
        return;
const key = entry.url;

if (seen.has(key))
    return;

seen.add(key);

    index.push({

        title: meta.title,

        normalizedTitle: meta.normalizedTitle,

        type: meta.type,

        year: meta.year,

        season: meta.season,

        episode: meta.episode,

        quality: meta.quality,

        codec: meta.codec,

        audio: meta.audio,

        language: meta.language,

        hdr: meta.hdr,

        source: meta.source,

        extension: meta.extension,

        filename: entry.name,

        url: entry.url,

        path: new URL(entry.url).pathname,

        server: new URL(entry.url).hostname,

        size: entry.size,

        modified: entry.modified

    });

    stats.videos++;

    if (stats.videos % 500 === 0) {

        console.log(
            `Indexed ${stats.videos} videos`
        );

    }

    if (stats.videos % 5000 === 0) {

        saveIndex();
        saveFolders();
        saveStats();

    }

}

async function build() {

    cleanupCache();

    index = [];

    folders = {};
    seen.clear();

    stats = {

        started: Date.now(),

        folders: 0,

        videos: 0

    };

    for (const root of ROOTS) {

        console.log("");

        console.log("Scanning");

        console.log(root);

        await crawler.crawlQueue(

    root,

    visit

);
    }

    saveIndex();

    saveFolders();

    saveStats();

    console.log("");

    console.log("Finished");

    console.log(stats);


}

function getIndex() {

    return index;

}

function getStats() {

    return stats;

}

module.exports = {

    build,

    getIndex,

    getStats

};