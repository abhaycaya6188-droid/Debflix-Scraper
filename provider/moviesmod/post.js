"use strict";

const { fetchText, decodeHtml, stripTags } = require("./http");

function parseQuality(text) {
  const value = String(text || "");

  if (/\b2160p\b|\b4k\b/i.test(value)) return "2160p";
  if (/\b1080p\b/i.test(value)) return "1080p";
  if (/\b720p\b/i.test(value)) return "720p";
  if (/\b480p\b/i.test(value)) return "480p";

  return "Unknown";
}

function parseCodec(text) {
  const value = String(text || "");

  if (/\b(?:x265|h[\s.]?265|hevc)\b/i.test(value)) return "HEVC";
  if (/\b(?:x264|h[\s.]?264|avc)\b/i.test(value)) return "H264";

  return "Unknown";
}

function parseBitDepth(text) {
  return /\b10[\s-]?bit\b/i.test(String(text || "")) ? "10-bit" : "";
}

function parseSize(text) {
  const matches = [
    ...String(text || "").matchAll(
      /\b(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)\b/gi
    ),
  ];

  if (!matches.length) return "";

  const match = matches[matches.length - 1];
  return `${match[1]}${match[2].toUpperCase()}`;
}

function parseLanguage(text) {
  const value = String(text || "");

  const hasHindi = /\bhind(?:i)?\b/i.test(value);
  const hasEnglish = /\benglish\b/i.test(value);

  if (hasHindi && hasEnglish) return "Hindi / English";
  if (/\bdual audio\b/i.test(value)) return "Dual Audio";
  if (/\bmulti(?:\s+audio)?\b/i.test(value)) return "Multi";
  if (hasHindi) return "Hindi";
  if (hasEnglish) return "English";

  return "Unknown";
}

function cleanContext(value) {
  return stripTags(
    decodeHtml(
      String(value || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
    )
  );
}

function parseModProLinks(html) {
  const pattern =
    /<a\b[^>]*href=["'](https?:\/\/links\.modpro\.blog\/archives\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;

  const matches = [];
  let match;

  while ((match = pattern.exec(html))) {
    matches.push({
      url: decodeHtml(match[1]).replace(/\/+$/, ""),
      label: cleanContext(match[2]),
      index: match.index,
      end: pattern.lastIndex,
    });
  }

  const links = [];
  const seen = new Set();

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];

    if (seen.has(current.url)) continue;
    seen.add(current.url);

    const previousEnd =
      index > 0
        ? matches[index - 1].end
        : Math.max(0, current.index - 900);

    const sectionHtml = html.slice(previousEnd, current.index);
    const sectionText = cleanContext(sectionHtml);

    const context = sectionText.slice(-500);

    links.push({
      url: current.url,
      label: current.label || "Download Links",
      context,
      quality: parseQuality(context),
      codec: parseCodec(context),
      bitDepth: parseBitDepth(context),
      size: parseSize(context),
      language: parseLanguage(context),
    });
  }

  return links;
}

async function getPostReleases(postUrl) {
  const response = await fetchText(postUrl, {
    headers: {
      Referer: "https://moviesmod.at/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const releases = parseModProLinks(response.text);

  if (!releases.length) {
    throw new Error(`No ModPro release links found on ${postUrl}`);
  }

  return {
    postUrl: response.url,
    releases,
  };
}

module.exports = {
  parseQuality,
  parseCodec,
  parseBitDepth,
  parseSize,
  parseLanguage,
  parseModProLinks,
  getPostReleases,
};