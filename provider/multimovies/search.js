"use strict";

const cheerio = require("cheerio");
const { CookieSession, responseText } = require("./http");

const DOMAIN_SOURCE =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_BASES = [
  "https://multimovies.makeup",
  "https://multimovies.study",
];

let cachedBase = "";
let cachedBaseExpires = 0;

async function getBaseCandidates() {
  const values = [];
  if (cachedBase && Date.now() < cachedBaseExpires) values.push(cachedBase);

  try {
    const response = await fetch(DOMAIN_SOURCE, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) {
      const domains = await response.json();
      if (domains.MultiMovies) values.push(String(domains.MultiMovies).replace(/\/$/, ""));
    }
  } catch {}

  values.push(...FALLBACK_BASES);
  return [...new Set(values.filter(Boolean))];
}

function normalize(value) {
  return String(value || "").normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function yearFrom(value) {
  return String(value || "").match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/)?.[1] || "";
}

function parseResults(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const results = [];
  $("article, .result-item, .item, .movies, .search-page .result-item").each((_, element) => {
    const root = $(element);
    const anchor = root.find('a[href*="/movies/"], a[href*="/tvshows/"], a[href*="/series/"]').first();
    if (!anchor.length) return;
    const url = new URL(anchor.attr("href"), baseUrl).href;
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
  let lastError;

  for (const baseUrl of await getBaseCandidates()) {
    try {
      const response = await session.fetch(`${baseUrl}/?s=${encodeURIComponent(title)}`, {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: `${baseUrl}/`,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      const candidates = parseResults(await responseText(response, "MultiMovies search"), baseUrl)
        .map(result => ({ ...result, score: rankResult(result, { title, year, type }) }))
        .filter(result => result.score >= 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (!candidates.length) {
        throw new Error(`No strict MultiMovies match for ${title} (${year || "unknown year"})`);
      }

      cachedBase = baseUrl;
      cachedBaseExpires = Date.now() + 30 * 60 * 1000;
      return { session, candidates };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("MultiMovies search failed on every known domain");
}

module.exports = {
  normalize,
  parseResults,
  rankResult,
  searchMultiMovies,
  getBaseCandidates,
};
