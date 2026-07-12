/* ============================================================
   CTG Index Builder
============================================================ */

const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const ROOTS = [
    "https://data.ctgfun.com/"
];

const CACHE_DIR =
    path.join(__dirname, "cache");

const INDEX_FILE =
    path.join(CACHE_DIR, "index3.json");
    
const STATS_FILE =
    path.join(CACHE_DIR, "stats3.json");

const FOLDERS_FILE =
    path.join(CACHE_DIR, "folders3.json");

const QUEUE_FILE =
    path.join(CACHE_DIR, "queue3.json");

const STATE_FILE =
    path.join(CACHE_DIR, "state3.json");
    const REJECTED_FILE =
    path.join(CACHE_DIR, "rejected3.json");

const AUDIT_FILE =
    path.join(CACHE_DIR, "audit3.json");

// ADD HERE
const INDEX_TMP_FILE =
    path.join(CACHE_DIR, "index3.tmp.json");

const FOLDERS_TMP_FILE =
    path.join(CACHE_DIR, "folders3.tmp.json");

const STATS_TMP_FILE =
    path.join(CACHE_DIR, "stats3.tmp.json");

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

    folders: 0,

    videos: 0,

    files: 0,

    videoFiles: 0,

    ignored: 0,

    rejected: 0,

    duplicates: 0

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
    stats.files++;

    if (entry.type === "directory") {

        folders[entry.url] = {

            scanned: true,

            modified: entry.modified || null

        };

        stats.folders++;

        return;
    }

    if (entry.type !== "video") {

    stats.ignored++;

    return;

}

    stats.videoFiles++;
    const meta = parser.parse(

    entry.name,

    entry.path

);




    if (!parser.validate(meta)) {

    stats.rejected++;

    rejected.push({

        file: entry.name,
        path: entry.url,
        reason: "parser-rejected"

    });

    return;

}
const key = entry.url;

if (seen.has(key)) {

    stats.duplicates++;

    rejected.push({

        file: entry.name,
        path: entry.url,
        reason: "duplicate"

    });

    return;

}

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

        console.log(
            `Indexed ${stats.videos} videos`
        );

    }

    if (stats.videos % 5000 === 0) {

        fs.writeFileSync(
    INDEX_TMP_FILE,
    JSON.stringify(index)
);

fs.writeFileSync(
    FOLDERS_TMP_FILE,
    JSON.stringify(folders)
);

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

    folders: 0,

    videos: 0,

    files: 0,

    videoFiles: 0,

    ignored: 0,

    rejected: 0,

    duplicates: 0

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
console.log(
    "FINAL IN-MEMORY INDEX:",
    index.length
);

if (index.length !== stats.videos) {

    throw new Error(
        `Index mismatch: index=${index.length}, videos=${stats.videos}`
    );

}


    saveIndex();

    saveFolders();

    saveStats();


    ;[
    INDEX_TMP_FILE,
    FOLDERS_TMP_FILE,
    STATS_TMP_FILE,
    QUEUE_FILE,
    STATE_FILE
].forEach(file => {

    if (fs.existsSync(file)) {

        fs.unlinkSync(file);

    }

});
    fs.writeFileSync(

    AUDIT_FILE,

    JSON.stringify(audit, null, 2)

);

fs.writeFileSync(

    REJECTED_FILE,

    JSON.stringify(rejected, null, 2)

);
    

    console.log("");

    console.log("Finished");

    console.log("");

console.log("========== CTG SERVER 3 ==========");

console.log("Folders         :", stats.folders);
console.log("Files           :", stats.files);
console.log("Video Files     :", stats.videoFiles);
console.log("Indexed Videos  :", stats.videos);
console.log("Ignored         :", stats.ignored);
console.log("Rejected        :", stats.rejected);
console.log("Duplicates      :", stats.duplicates);
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