"use strict";

const fs = require("fs");
const path = require("path");

const crawler = require("./crawler");
const parser = require("./parser");

const CACHE_DIR = path.join(__dirname, "cache");

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`[CTG-INCREMENTAL] Failed reading ${file}:`, error.message);
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function toIndexEntry(entry, meta) {
  const parsedUrl = new URL(entry.url);

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
    path: parsedUrl.pathname,
    server: parsedUrl.hostname,
    size: entry.size,
    modified: entry.modified,
  };
}

function createStats(server, beforeCount) {
  return {
    server,
    mode: "incremental",
    started: Date.now(),
    beforeCount,
    afterCount: beforeCount,
    foldersVisited: 0,
    filesSeen: 0,
    videoFilesSeen: 0,
    existingVideos: 0,
    newVideos: 0,
    newMovies: 0,
    newEpisodes: 0,
    rejected: 0,
    duplicateNewUrls: 0,
    ignored: 0,
    failures: 0,
  };
}

async function runIncremental(config) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const indexFile = path.join(CACHE_DIR, config.indexFile);
  const foldersFile = path.join(CACHE_DIR, config.foldersFile);
  const statsFile = path.join(CACHE_DIR, config.incrementalStatsFile);
  const addedFile = path.join(CACHE_DIR, config.addedFile);

  const index = readJson(indexFile, []);
  const folders = readJson(foldersFile, {});
  const knownUrls = new Set(index.map(item => item?.url).filter(Boolean));
  const addedUrls = new Set();
  const added = [];
  const stats = createStats(config.name, index.length);

  async function visit(entry) {
    stats.filesSeen++;

    if (entry.type === "directory") {
      stats.foldersVisited++;
      folders[entry.url] = {
        scanned: true,
        modified: entry.modified || null,
        lastIncrementalScan: Date.now(),
      };
      return;
    }

    if (entry.type !== "video") {
      stats.ignored++;
      return;
    }

    stats.videoFilesSeen++;

    if (knownUrls.has(entry.url)) {
      stats.existingVideos++;
      return;
    }

    if (addedUrls.has(entry.url)) {
      stats.duplicateNewUrls++;
      return;
    }

    const meta = parser.parse(entry.name, entry.path);

    if (!parser.validate(meta)) {
      stats.rejected++;
      return;
    }

    const indexed = toIndexEntry(entry, meta);
    index.push(indexed);
    added.push(indexed);
    addedUrls.add(entry.url);
    knownUrls.add(entry.url);

    stats.newVideos++;
    if (indexed.type === "tv") stats.newEpisodes++;
    else stats.newMovies++;

    if (stats.newVideos % 100 === 0) {
      console.log(`[CTG-INCREMENTAL:${config.name}] Added ${stats.newVideos} new videos`);
    }
  }

  console.log(`\n========== CTG INCREMENTAL ${config.name} ==========`);
  console.log(`Existing index: ${index.length}`);
  console.log(`Root: ${config.root}`);

  try {
    await crawler.crawlQueue(config.root, visit);
  } catch (error) {
    stats.failures++;
    stats.error = error.message;
    throw error;
  } finally {
    stats.finished = Date.now();
    stats.duration = stats.finished - stats.started;
    stats.afterCount = index.length;

    writeJsonAtomic(indexFile, index);
    writeJsonAtomic(foldersFile, folders);
    writeJsonAtomic(statsFile, stats);
    writeJsonAtomic(addedFile, added);

    console.log(`[CTG-INCREMENTAL:${config.name}] New videos: ${stats.newVideos}`);
    console.log(`[CTG-INCREMENTAL:${config.name}] New movies: ${stats.newMovies}`);
    console.log(`[CTG-INCREMENTAL:${config.name}] New episodes: ${stats.newEpisodes}`);
    console.log(`[CTG-INCREMENTAL:${config.name}] Existing skipped: ${stats.existingVideos}`);
    console.log(`[CTG-INCREMENTAL:${config.name}] Index: ${stats.beforeCount} -> ${stats.afterCount}`);
    console.log("=================================================\n");
  }

  return stats;
}

module.exports = {
  runIncremental,
};
