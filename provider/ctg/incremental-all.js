/* Incrementally update all five CTG indexes without deleting existing data. */
const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const CACHE_DIR = path.join(__dirname, "cache");
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SERVER_ARG = process.argv.find(argument => argument.startsWith("--server="));
const ONLY_SERVER = SERVER_ARG ? SERVER_ARG.split("=")[1] : null;

const SERVERS = [
    { id: "1", suffix: "", frontierDepth: 0, roots: ["https://movie.ctgfun.com/"] },
    { id: "2", suffix: "2", frontierDepth: 1, roots: ["https://ftp.ctgfun.com/"] },
    { id: "3", suffix: "3", frontierDepth: 1, roots: ["https://data.ctgfun.com/"] },
    {
        id: "4",
        suffix: "4",
        frontierDepth: 1,
        roots: Array.from({ length: 11 }, (_, i) =>
            `https://media.ctgfun.com/disk${i + 1}/`
        )
    },
    {
        id: "5",
        suffix: "5",
        frontierDepth: 1,
        roots: Array.from({ length: 6 }, (_, i) =>
            `https://dl.ctgfun.com/disk${i + 1}/`
        )
    }
];

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function atomicWriteJson(file, value) {
    const temporary = `${file}.incremental.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
    fs.renameSync(temporary, file);
}

function indexEntry(entry, meta) {
    return {
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
    };
}

async function crawlWithRetry(url, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const originalLog = console.log;
        if (!VERBOSE) console.log = () => {};
        try {
            return await crawler.crawl(url);
        } catch (error) {
            lastError = error;
        } finally {
            console.log = originalLog;
        }
    }
    throw lastError;
}

async function updateServer(server) {
    const indexFile = path.join(CACHE_DIR, `index${server.suffix}.json`);
    const foldersFile = path.join(CACHE_DIR, `folders${server.suffix}.json`);
    const statsFile = path.join(
        CACHE_DIR,
        `incremental-stats${server.suffix}.json`
    );
    const addedFile = path.join(
        CACHE_DIR,
        `incremental-added${server.suffix}.json`
    );
    const previousStats = readJson(statsFile, {});

    if (!fs.existsSync(indexFile) || !fs.existsSync(foldersFile)) {
        throw new Error(
            `CTG ${server.id}: existing index/folder cache is required`
        );
    }

    const index = readJson(indexFile, []);
    const folders = readJson(foldersFile, {});
    const seen = new Set(index.map(entry => entry.url).filter(Boolean));
    const queue = server.roots.map(url => ({ url, depth: 0 }));
    const queued = new Set(server.roots);
    const visited = new Set();
    const addedEntries = [];
    const started = Date.now();
    const stats = {
        server: server.id,
        dryRun: DRY_RUN,
        existingEntries: index.length,
        previousSuccessfulAt: previousStats.finishedAt || null,
        rootsChecked: server.roots.length,
        directoriesChecked: 0,
        unchangedDirectoriesSkipped: 0,
        timestampLessDirectoriesSkipped: 0,
        frontierDirectoriesQueued: 0,
        newDirectories: 0,
        changedDirectories: 0,
        newVideos: 0,
        newMovies: 0,
        newEpisodes: 0,
        rejectedVideos: 0,
        duplicateVideos: 0,
        dateBaselinesAdded: 0,
        nonStreamingDirectoriesSkipped: 0,
        failures: []
    };

    for (let pointer = 0; pointer < queue.length; pointer++) {
        const current = queue[pointer];
        if (visited.has(current.url)) continue;
        visited.add(current.url);

        let entries;
        try {
            entries = await crawlWithRetry(current.url);
            stats.directoriesChecked++;
        } catch (error) {
            stats.failures.push({ url: current.url, error: String(error) });
            continue;
        }

        for (const entry of entries) {
            if (entry.type === "directory") {
                if (!parser.isStreamingPath(`${entry.path}/__entry__.mp4`)) {
                    stats.nonStreamingDirectoriesSkipped++;
                    continue;
                }

                const previous = folders[entry.url];
                const modified = entry.modified || null;
                const isNew = !previous;
                const dateBaselineAdded =
                    !isNew && !previous.modified && modified !== null;
                const changed =
                    isNew ||
                    (!dateBaselineAdded &&
                        modified !== null &&
                        modified !== (previous.modified || null));
                const refreshFrontier =
                    !isNew &&
                    modified === null &&
                    current.depth < server.frontierDepth;
                const baselineFrontier =
                    dateBaselineAdded && current.depth < server.frontierDepth;

                folders[entry.url] = {
                    scanned: true,
                    modified,
                    lastIncrementalScan: Date.now()
                };
                if (isNew) stats.newDirectories++;
                else if (dateBaselineAdded) stats.dateBaselinesAdded++;
                else if (changed) stats.changedDirectories++;
                else if (modified === null) stats.timestampLessDirectoriesSkipped++;
                else stats.unchangedDirectoriesSkipped++;

                if (refreshFrontier || baselineFrontier) {
                    stats.frontierDirectoriesQueued++;
                }

                if (
                    (changed || refreshFrontier || baselineFrontier) &&
                    !queued.has(entry.url)
                ) {
                    queue.push({ url: entry.url, depth: current.depth + 1 });
                    queued.add(entry.url);
                }
                continue;
            }

            if (entry.type !== "video") continue;
            if (seen.has(entry.url)) {
                stats.duplicateVideos++;
                continue;
            }

            const meta = parser.parse(entry.name, entry.path);
            if (!parser.validate(meta)) {
                stats.rejectedVideos++;
                continue;
            }

            const added = indexEntry(entry, meta);
            seen.add(entry.url);
            index.push(added);
            addedEntries.push(added);
            stats.newVideos++;
            if (added.type === "tv") stats.newEpisodes++;
            else stats.newMovies++;
        }
    }

    stats.finalEntries = index.length;
    stats.durationMs = Date.now() - started;
    stats.finishedAt = new Date().toISOString();

    // Incremental indexing is append-only. A failed directory does not damage
    // existing data, so keep any new entries discovered from healthy roots.
    stats.safeToWrite = stats.directoriesChecked > 0;
    stats.partial = stats.failures.length > 0;

    if (!DRY_RUN && stats.safeToWrite) {
        atomicWriteJson(indexFile, index);
        atomicWriteJson(foldersFile, folders);
        atomicWriteJson(statsFile, stats);
        atomicWriteJson(addedFile, addedEntries);
    }

    console.log(
        `[CTG-${server.id}] +${stats.newVideos} ` +
        `(${stats.newMovies} movies, ${stats.newEpisodes} episodes) ` +
        `[${stats.existingEntries} -> ${stats.finalEntries}]`
    );
    if (stats.failures.length) {
        console.log(`[CTG-${server.id}] partial scan; failures: ${stats.failures.length}`);
    }
    return stats;
}

(async () => {
    const startedAt = Date.now();
    const results = [];
    for (const server of SERVERS.filter(
        candidate => !ONLY_SERVER || candidate.id === ONLY_SERVER
    )) {
        results.push(await updateServer(server));
    }

    const summary = {
        mode: "incremental",
        dryRun: DRY_RUN,
        serverFilter: ONLY_SERVER,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        totalNewVideos: results.reduce((sum, result) => sum + result.newVideos, 0),
        totalNewMovies: results.reduce((sum, result) => sum + result.newMovies, 0),
        totalNewEpisodes: results.reduce((sum, result) => sum + result.newEpisodes, 0),
        totalFailures: results.reduce((sum, result) => sum + result.failures.length, 0),
        servers: results
    };

    if (!DRY_RUN) {
        atomicWriteJson(
            path.join(CACHE_DIR, "incremental-summary.json"),
            summary
        );
    }

    console.log("\n================ CTG INCREMENTAL SUMMARY ================");
    for (const result of results) {
        console.log(
            `Server ${result.server}: +${result.newVideos} ` +
            `(${result.newMovies} movies, ${result.newEpisodes} episodes) ` +
            `[${result.existingEntries} -> ${result.finalEntries}]`
        );
    }
    console.log(`TOTAL NEW VIDEOS: ${summary.totalNewVideos}`);
    console.log(`TOTAL NEW MOVIES: ${summary.totalNewMovies}`);
    console.log(`TOTAL NEW EPISODES: ${summary.totalNewEpisodes}`);
    console.log(`TOTAL FAILURES: ${summary.totalFailures}`);
    console.log("=========================================================\n");

    if (summary.totalFailures > 0) process.exitCode = 1;
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
