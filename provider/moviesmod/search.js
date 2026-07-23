"use strict";

const { fetchText, decodeHtml, stripTags } = require("./http");

const BASE_URL = "https://moviesmod.at";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractYear(value) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function parseSearchResults(html) {
  const results = [];
  const seen = new Set();

  const anchorPattern =
    /<a\b[^>]*href=["'](https?:\/\/moviesmod\.at\/[^"'#?]+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorPattern.exec(html))) {
    const url = decodeHtml(match[1]).replace(/\/+$/, "") + "/";
    const title = stripTags(match[2]);

    if (!title || title.length < 3) continue;
    if (!url.includes("/download-")) continue;
    if (seen.has(url)) continue;

    seen.add(url);

    results.push({
      title,
      url,
      year: extractYear(title),
    });
  }

  return results;
}

function scoreResult(result, wantedTitle, wantedYear) {
  const wanted = normalize(wantedTitle);
  const candidate = normalize(result.title);

  if (!wanted || !candidate) return -1;

  let score = 0;

  if (candidate === wanted) score += 1000;
  if (candidate.startsWith(wanted)) score += 700;
  if (candidate.includes(wanted)) score += 500;

  const wantedWords = wanted.split(" ").filter(Boolean);

  for (const word of wantedWords) {
    if (candidate.includes(word)) score += 50;
  }

  if (wantedYear) {
    if (result.year === String(wantedYear)) {
      score += 250;
    } else if (result.year) {
      score -= 150;
    }
  }

  if (/download/i.test(result.url)) score += 25;

  return score;
}

async function searchMoviesMod({ title, year }) {
  const query = [title, year].filter(Boolean).join(" ");
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;

  const response = await fetchText(url, {
    headers: {
      Referer: `${BASE_URL}/`,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const results = parseSearchResults(response.text)
    .map((result) => ({
      ...result,
      score: scoreResult(result, title, year),
    }))
    .filter((result) => result.score >= 100)
    .sort((a, b) => b.score - a.score);

  if (!results.length) {
    throw new Error(`MoviesMod search returned no match for "${query}"`);
  }

  return {
    query,
    searchUrl: response.url,
    result: results[0],
    results,
  };
}

module.exports = {
  BASE_URL,
  normalize,
  parseSearchResults,
  scoreResult,
  searchMoviesMod,
};
