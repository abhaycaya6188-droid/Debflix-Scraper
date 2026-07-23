"use strict";

const { CookieSession } = require("./http");
const { searchMultiMovies } = require("./search");
const { resolveDooplay, resolveSmoothpre } = require("./gdmirror");
const { extractSmoothpre } = require("./smoothpre");

const cache = new Map();
const CACHE_MS = 4 * 60 * 1000;

function cacheKey(options) {
  return [options.type, options.title, options.year, options.season, options.episode].join(":");
}

async function getStreams(options) {
  const key = cacheKey(options);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.streams;
  const { session, candidates } = await searchMultiMovies({ ...options, session: new CookieSession() });
  let lastError;
  for (const candidate of candidates) {
    try {
      const embed = await resolveDooplay(candidate.url, options, session);
      const smoothpre = await resolveSmoothpre(embed, session);
      const hls = await extractSmoothpre(smoothpre.url, session);
      const directUrl = hls.url;
      const url = options.makeProxyUrl ? options.makeProxyUrl(directUrl, hls.referer) : directUrl;
      const streams = [{
        provider: "MultiMovies", name: "Smoothpre", host: "Smoothpre",
        quality: "1080p", codec: "H264", language: "Hindi / English",
        audioTracks: ["Hindi", "English"], streamType: "HLS", url,
        referer: hls.referer, requiresProxy: true, adaptive: true, source: hls.selected,
      }];
      cache.set(key, { streams, expires: Date.now() + CACHE_MS });
      return streams;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("MultiMovies resolution failed");
}

module.exports = { getStreams };
