/* ============================================================
   CTG Index Builder
============================================================ */

const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const ROOTS = [
    { name: "disk1", url: "https://dl.ctgfun.com/disk1/" },
    { name: "disk2", url: "https://dl.ctgfun.com/disk2/" },
    { name: "disk3", url: "https://dl.ctgfun.com/disk3/" },
    { name: "disk4", url: "https://dl.ctgfun.com/disk4/" },
    { name: "disk5", url: "https://dl.ctgfun.com/disk5/" },
    { name: "disk6", url: "https://dl.ctgfun.com/disk6/" },
    
];

const CACHE_DIR =
    path.join(__dirname, "cache");

const INDEX_FILE =
    path.join(CACHE_DIR, "index5.json");
    
const STATS_FILE =
    path.join(CACHE_DIR, "stats5.json");

const FOLDERS_FILE =
    path.join(CACHE_DIR, "folders5.json");

const QUEUE_FILE =
    path.join(CACHE_DIR, "queue5.json");

const STATE_FILE =
    path.join(CACHE_DIR, "state5.json");
    const REJECTED_FILE =
    path.join(CACHE_DIR, "rejected5.json");

const AUDIT_FILE =
    path.join(CACHE_DIR, "audit5.json");

// ADD HERE
const INDEX_TMP_FILE =
    path.join(CACHE_DIR, "index5.tmp.json");

const FOLDERS_TMP_FILE =
    path.join(CACHE_DIR, "folders5.tmp.json");

const STATS_TMP_FILE =
    path.join(CACHE_DIR, "stats5.tmp.json");

if (!fs.existsSync(CACHE_DIR)) {

    fs.mkdirSync(CACHE_DIR, {
        recursive: true
    });

}

let index = [];

let folders = {};
let seen = new Set();
let rejected = [];
let audit = [];

let stats = {

    started: Date.now(),

    finished: 0,
    duration: 0,

    folders: 0,

    filesSeen: 0,
    videoFiles: 0,

    videos: 0,

    parserRejected: 0,
    duplicateSkipped: 0,

    movies: 0,
    episodes: 0,

    maxDepth: 0

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
    STATE_FILE,

    AUDIT_FILE,
    REJECTED_FILE

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
    stats.filesSeen++;

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


    stats.videoFiles++;
    const meta = parser.parse(

    entry.name,

    entry.path

);

    if (!parser.validate(meta)) {

    stats.parserRejected++;

    rejected.push({

        file: entry.name,
        path: entry.url,
        reason: "parser-rejected"

    });

    return;

}
const key = entry.url;

if (seen.has(key)) {

    stats.duplicateSkipped++;

    rejected.push({

        file: entry.name,
        path: entry.url,
        reason: "duplicate"

    });

    return;

}

seen.add(key);
if (meta.type === "movie")
    stats.movies++;

if (meta.type === "tv")
    stats.episodes++;



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

    audit.push({

    title: meta.title,

    type: meta.type,

    season: meta.season,

    episode: meta.episode,

    quality: meta.quality,

    filename: entry.name,

    url: entry.url

});

    stats.videos++;

    if (stats.videos % 500 === 0) {

        

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

audit = [];

rejected = [];

    stats = {

    started: Date.now(),

    finished: 0,
    duration: 0,

    folders: 0,

    filesSeen: 0,
    videoFiles: 0,

    videos: 0,

    parserRejected: 0,
    duplicateSkipped: 0,

    movies: 0,
    episodes: 0,

    maxDepth: 0

};

    for (const root of ROOTS) {

       

        await crawler.crawlQueue(

    root,

    visit

);
    }

    saveIndex();

    saveFolders();

    saveStats();
    fs.writeFileSync(

    AUDIT_FILE,

    JSON.stringify(audit, null, 2)

);

fs.writeFileSync(

    REJECTED_FILE,

    JSON.stringify(rejected, null, 2)

);
    

   

console.log("========== CTG SERVER 5 ==========");

console.log("Folders         :", stats.folders);
console.log("Files Seen      :", stats.filesSeen);
console.log("Video Files     :", stats.videoFiles);
console.log("Indexed Videos  :", stats.videos);
console.log("Movies          :", stats.movies);
console.log("Episodes        :", stats.episodes);
console.log("Parser Rejected :", stats.parserRejected);
console.log("Duplicates      :", stats.duplicateSkipped);
console.log("Max Depth       :", stats.maxDepth);
console.log("Duration (sec)  :", (stats.duration / 1000).toFixed(1));

console.log("==================================");


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