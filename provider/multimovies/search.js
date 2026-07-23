"use strict";

const cheerio = require("cheerio");
const { CookieSession, responseText } = require("./http");

const BASE_URL = "https://multimovies.study";

function normalize(value) {
  return String(value || "").normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function yearFrom(value) {
  return String(value || "").match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/)?.[1] || "";
}

function parseResults(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const results = [];
  $("article, .result-item, .item, .movies, .search-page .result-item").each((_, element) => {
    const root = $(element);
    const anchor = root.find('a[href*="/movies/"], a[href*="/tvshows/"], a[href*="/series/"]').first();
    if (!anchor.length) return;
    const url = new URL(anchor.attr("href"), BASE_URL).href;
    if (seen.has(url)) return;
    seen.add(url);
    const title = anchor.attr("title") || root.find("h2,h3,.title").first().text() || anchor.text();
    const text = root.text();
    results.push({ url, title: title.trim(), year: yearFrom(text), text: text.trim() });
  });
  return results;
}

function rankResult(result, wanted) {
  const actualTitle = normalize(result.title);
  const title = normalize(wanted.title);
  let score = actualTitle === title ? 100 : actualTitle.includes(title) || title.includes(actualTitle) ? 55 : 0;
  if (wanted.year && result.year === String(wanted.year)) score += 30;
  else if (wanted.year && result.year) score -= 40;
  const isMovie = /\/movies\//.test(result.url);
  if ((wanted.type === "movie") === isMovie) score += 20;
  else score -= 50;
  return score;
}

async function searchMultiMovies({ title, year, type = "movie", session = new CookieSession() }) {
  const response = await session.fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${BASE_URL}/`,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  },
});
  const candidates = parseResults(await responseText(response, "MultiMovies search"))
    .map(result => ({ ...result, score: rankResult(result, { title, year, type }) }))
    .filter(result => result.score >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!candidates.length) throw new Error(`No strict MultiMovies match for ${title} (${year || "unknown year"})`);
  return { session, candidates };
}

module.exports = { BASE_URL, normalize, parseResults, rankResult, searchMultiMovies };
