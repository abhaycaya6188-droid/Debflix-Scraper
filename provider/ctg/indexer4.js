/* ============================================================
   CTG Server 4 Index Builder
   media.ctgfun.com
============================================================ */

const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const ROOTS = [
    { name: "disk1", url: "https://media.ctgfun.com/disk1/" },
    { name: "disk2", url: "https://media.ctgfun.com/disk2/" },
    { name: "disk3", url: "https://media.ctgfun.com/disk3/" },
    { name: "disk4", url: "https://media.ctgfun.com/disk4/" },
    { name: "disk5", url: "https://media.ctgfun.com/disk5/" },
    { name: "disk6", url: "https://media.ctgfun.com/disk6/" },
    { name: "disk7", url: "https://media.ctgfun.com/disk7/" },
    { name: "disk8", url: "https://media.ctgfun.com/disk8/" },
    { name: "disk9", url: "https://media.ctgfun.com/disk9/" },
    { name: "disk10", url: "https://media.ctgfun.com/disk10/" },
    { name: "disk11", url: "https://media.ctgfun.com/disk11/" }
];

const CACHE_DIR =
    path.join(__dirname, "cache");

const INDEX_FILE =
    path.join(CACHE_DIR, "index4.json");

const STATS_FILE =
    path.join(CACHE_DIR, "stats4.json");

const FOLDERS_FILE =
    path.join(CACHE_DIR, "folders4.json");

const QUEUE_FILE =
    path.join(CACHE_DIR, "queue4.json");

const STATE_FILE =
    path.join(CACHE_DIR, "state4.json");

const REJECTED_FILE =
    path.join(CACHE_DIR, "rejected4.json");

const AUDIT_FILE =
    path.join(CACHE_DIR, "audit4.json");

const INDEX_TMP_FILE =
    path.join(CACHE_DIR, "index4.tmp.json");

const FOLDERS_TMP_FILE =
    path.join(CACHE_DIR, "folders4.tmp.json");

const STATS_TMP_FILE =
    path.join(CACHE_DIR, "stats4.tmp.json");

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

let stats = createStats();

function createStats() {
    return {
        started: Date.now(),

        folders: 0,
        videos: 0,
        files: 0,
        videoFiles: 0,
        ignored: 0,
        rejected: 0,
        duplicates: 0
    };
}

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

function saveCheckpoint() {
    fs.writeFileSync(
        INDEX_TMP_FILE,
        JSON.stringify(index)
    );

    fs.writeFileSync(
        FOLDERS_TMP_FILE,
        JSON.stringify(folders)
    );

    fs.writeFileSync(
        STATS_TMP_FILE,
        JSON.stringify({
            ...stats,
            checkpointed: Date.now(),
            duration:
                Date.now() - stats.started
        }, null, 2)
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

function cleanupTemporaryFiles() {
    const files = [
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
        saveCheckpoint();

        console.log(
            `[CHECKPOINT] ${stats.videos} entries saved`
        );
    }
}

async function build() {
    cleanupCache();

    index = [];
    folders = {};
    seen.clear();

    audit = [];
    rejected = [];

    stats = createStats();

    for (const root of ROOTS) {
        console.log("");
        console.log(
            `Scanning ${root.name}`
        );
        console.log(root.url);

        await crawler.crawlQueue(
            root.url,
            visit
        );

        console.log(
            `[DISK COMPLETE] ${root.name}`
        );

        console.log(
            `Current indexed videos: ${stats.videos}`
        );
    }

    console.log("");
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

    fs.writeFileSync(
        AUDIT_FILE,
        JSON.stringify(audit, null, 2)
    );

    fs.writeFileSync(
        REJECTED_FILE,
        JSON.stringify(rejected, null, 2)
    );

    cleanupTemporaryFiles();

    console.log("");
    console.log("Finished");
    console.log("");

    console.log(
        "========== CTG SERVER 4 =========="
    );

    console.log(
        "Folders        :",
        stats.folders
    );

    console.log(
        "Files          :",
        stats.files
    );

    console.log(
        "Video Files    :",
        stats.videoFiles
    );

    console.log(
        "Indexed Videos :",
        stats.videos
    );

    console.log(
        "Ignored        :",
        stats.ignored
    );

    console.log(
        "Rejected       :",
        stats.rejected
    );

    console.log(
        "Duplicates     :",
        stats.duplicates
    );

    console.log(
        "Duration (sec) :",
        (stats.duration / 1000).toFixed(1)
    );

    console.log(
        "=================================="
    );
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