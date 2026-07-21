
"use strict";

const { searchMoviesMod } = require("./search");
const { getPostReleases } = require("./post");
const { getModProTargets } = require("./modpro");
const { resolveCloudLink } = require("./cloud");
const { getDriveSeedFilePage } = require("./driveseed");

function detectCodec(filename, fallback = "Unknown") {
  const value = String(filename || "");

  if (/\b(?:x265|h[\s.]?265|hevc)\b/i.test(value)) return "HEVC";
  if (/\b(?:x264|h[\s.]?264|avc)\b/i.test(value)) return "H264";

  return fallback;
}

function detectQuality(filename, fallback = "Unknown") {
  const value = String(filename || "");

  if (/\b2160p\b|\b4k\b/i.test(value)) return "2160p";
  if (/\b1080p\b/i.test(value)) return "1080p";
  if (/\b720p\b/i.test(value)) return "720p";
  if (/\b480p\b/i.test(value)) return "480p";

  return fallback;
}

function detectLanguage(filename, fallback = "Unknown") {
  const value = String(filename || "");

  const hasHindi = /\bhindi\b/i.test(value);
  const hasEnglish = /\benglish\b/i.test(value);

  if (hasHindi && hasEnglish) return "Hindi / English";
  if (/\bdual[\s._-]*audio\b/i.test(value)) return "Dual Audio";
  if (/\bmulti\b/i.test(value)) return "Multi";
  if (hasHindi) return "Hindi";
  if (hasEnglish) return "English";

  return fallback;
}

function detectBitDepth(filename, fallback = "") {
  return /\b10[\s._-]?bit\b/i.test(String(filename || ""))
    ? "10-bit"
    : fallback;
}

function detectSource(filename) {
  const value = String(filename || "");

  if (/\bbluray\b/i.test(value)) return "BluRay";
  if (/\bweb[\s._-]?dl\b/i.test(value)) return "WEB-DL";
  if (/\bwebrip\b/i.test(value)) return "WEBRip";
  if (/\bhdrip\b/i.test(value)) return "HDRip";
  if (/\bdvdrip\b/i.test(value)) return "DVDRip";

  return "Unknown";
}

function makeStream(release, file, postUrl) {
  const filename = file.filename || "";
  const quality = detectQuality(filename, release.quality);
  const codec = detectCodec(filename, release.codec);
  const language = detectLanguage(filename, release.language);
  const bitDepth = detectBitDepth(filename, release.bitDepth);

  return {
    id: [
      "moviesmod",
      quality.toLowerCase(),
      codec.toLowerCase(),
      bitDepth || "standard",
      String(file.filePageUrl || "")
        .split("/")
        .filter(Boolean)
        .pop() || "file",
    ].join("-"),

    provider: "MoviesMod",
    name: `MoviesMod ${quality}`,
    quality,
    codec,
    bitDepth,
    language,
    source: detectSource(filename),
    size: file.size || release.size || "",
    container: file.format || "MKV",
    filename,

    streamType: "DirectFile",
    browserFriendly: !/\.mkv$/i.test(filename),

    url: file.primaryDownload.url,
    downloadUrl: file.primaryDownload.url,
    downloadLabel: file.primaryDownload.label,

    sourcePage: postUrl,
    modProUrl: release.url,
    driveSeedUrl: file.filePageUrl,
  };
}

async function resolveRelease(release, postUrl) {
  const targets = await getModProTargets(release.url);

  if (!targets.cloudLinks.length) {
    throw new Error(`No cloud links found for ${release.url}`);
  }

  let lastError;

  for (const target of targets.cloudLinks) {
    try {
      const cloud = await resolveCloudLink(target.url);
      const file = await getDriveSeedFilePage(cloud.driveSeedUrl);

      return makeStream(release, file, postUrl);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Unable to resolve ${release.url}`);
}

async function getStreams({ title, year, type = "movie" }) {
  if (type !== "movie") {
    throw new Error("MoviesMod TV support is not implemented yet");
  }

  const search = await searchMoviesMod({ title, year });
  const post = await getPostReleases(search.result.url);

  const settled = await Promise.allSettled(
    post.releases.map((release) =>
      resolveRelease(release, post.postUrl)
    )
  );

  const streams = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  const seen = new Set();

  const uniqueStreams = streams.filter((stream) => {
    if (!stream.url || seen.has(stream.url)) return false;

    seen.add(stream.url);
    return true;
  });

  uniqueStreams.sort((a, b) => {
    const qualityRank = {
      "2160p": 4,
      "1080p": 3,
      "720p": 2,
      "480p": 1,
      Unknown: 0,
    };

    return (
      (qualityRank[b.quality] || 0) -
      (qualityRank[a.quality] || 0)
    );
  });

  if (!uniqueStreams.length) {
    const errors = settled
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message || String(result.reason));

    throw new Error(
      `MoviesMod found releases but none resolved${
        errors.length ? `: ${errors.join(" | ")}` : ""
      }`
    );
  }

  return {
    provider: "MoviesMod",
    title,
    year: String(year || ""),
    type,
    postUrl: post.postUrl,
    streams: uniqueStreams,
  };
}

module.exports = {
  detectCodec,
  detectQuality,
  detectLanguage,
  detectBitDepth,
  detectSource,
  makeStream,
  resolveRelease,
  getStreams,
};