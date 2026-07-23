const vm = require("vm");

const DOMAIN_SOURCE =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_DOMAIN = "https://new3.hdhub4u.cl";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36";

let catalogueCache = null;
let catalogueExpiresAt = 0;

async function fetchText(target, referer) {
  const response = await fetch(target, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: referer || new URL(target).origin + "/",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`HDStream4U upstream returned ${response.status}`);
  return response.text();
}

async function currentDomain() {
  try {
    const response = await fetch(DOMAIN_SOURCE, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    const domains = await response.json();
    return String(domains.HDHUB4u || domains.HDHUB4U || FALLBACK_DOMAIN).replace(/\/$/, "");
  } catch {
    return FALLBACK_DOMAIN;
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2f;|&#47;/gi, "/")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'");
}

async function loadCatalogue() {
  if (catalogueCache && Date.now() < catalogueExpiresAt) return catalogueCache;

  const domain = await currentDomain();
  const candidates = [`${domain}/sitemap.xml`, `${domain}/sitemap_index.xml`];
  let index = "";

  for (const candidate of candidates) {
    try {
      index = await fetchText(candidate, domain + "/");
      if (/<loc>/i.test(index)) break;
    } catch {}
  }

  const listedUrls = [...index.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map(match => decodeHtml(match[1]));
  const sitemapUrls = listedUrls.filter(value => /sitemap/i.test(value));
  const directUrls = listedUrls.filter(value => !/sitemap/i.test(value));

  const maps = await Promise.all(
    sitemapUrls.slice(0, 20).map(async sitemapUrl => {
      try {
        return await fetchText(sitemapUrl, domain + "/");
      } catch {
        return "";
      }
    })
  );

  catalogueCache = [...new Set([
    ...directUrls,
    ...maps.flatMap(map =>
      [...map.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => decodeHtml(match[1]))
    ),
  ])];
  catalogueExpiresAt = Date.now() + 30 * 60 * 1000;
  return catalogueCache;
}

function words(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreUrl(target, { title, year, type, season }) {
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(target).pathname).toLowerCase();
  } catch {
    return -10_000;
  }

  const wanted = words(title);
  const found = new Set(words(slug));
  let score = wanted.reduce((total, word) => total + (found.has(word) ? 20 : -25), 0);

  if (year && found.has(String(year))) score += 40;
  if (type === "tv" && season) {
    const number = Number(season);
    const padded = String(number).padStart(2, "0");
    if (
      slug.includes(`season-${number}`) ||
      slug.includes(`season-${padded}`) ||
      slug.includes(`season ${number}`) ||
      slug.includes(`s${padded}`)
    ) score += 90;
  } else if (/full-movie|movie-download/.test(slug)) {
    score += 20;
  }

  return score;
}

async function searchFallback(domain, title) {
  try {
    const html = await fetchText(`${domain}/?s=${encodeURIComponent(title)}`, domain + "/");
    return [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map(match => decodeHtml(match[1]))
      .map(value => {
        try {
          return new URL(value, domain).href;
        } catch {
          return "";
        }
      })
      .filter(value => value.startsWith(domain));
  } catch {
    return [];
  }
}

async function findTitlePages(options) {
  const domain = await currentDomain();
  const catalogue = await loadCatalogue();
  const searchUrls = await searchFallback(domain, options.title);

  return [...new Set([...catalogue, ...searchUrls])]
    .map(target => ({ target, score: scoreUrl(target, options) }))
    .filter(item => item.score >= -20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function decodeJavascriptString(raw) {
  return vm.runInNewContext(`'${raw}'`, Object.create(null), { timeout: 50 });
}

function unpackPlayer(html) {
  const match = html.match(
    /eval\(function\(p,a,c,k,e,d\).*?\}\('((?:\\.|[^'])*)',(\d+),\d+,'((?:\\.|[^'])*)'\.split\('\|'\)\)\)/s
  );
  if (!match) return "";

  let payload = decodeJavascriptString(match[1]);
  const radix = Number(match[2]);
  const dictionary = decodeJavascriptString(match[3]).split("|");
  const token = value => {
    let encoded = "";
    do {
      const digit = value % radix;
      encoded = (digit > 35 ? String.fromCharCode(digit + 29) : digit.toString(36)) + encoded;
      value = Math.floor(value / radix);
    } while (value > 0);
    return encoded;
  };

  for (let index = dictionary.length - 1; index >= 0; index -= 1) {
    if (!dictionary[index]) continue;
    payload = payload.replace(new RegExp(`\\b${token(index)}\\b`, "g"), dictionary[index]);
  }
  return payload;
}

async function resolvePlayer(playerUrl) {
  const parsed = new URL(playerUrl);
  if (!/(^|\.)hdstream4u\.com$/i.test(parsed.hostname)) {
    throw new Error("Unsupported HDStream4U host");
  }

  const html = await fetchText(parsed.href, parsed.origin + "/");
  const unpacked = unpackPlayer(html) || html;
  const normalized = decodeHtml(unpacked).replace(/\\\//g, "/");
  const urls = [...normalized.matchAll(/(?:https?:\/\/|\/\/|\/)[^"'\s<>]+\.m3u8[^"'\s<>]*/gi)]
    .map(match => {
      const raw = match[0];
      return new URL(raw.startsWith("//") ? `https:${raw}` : raw, parsed.origin).href;
    });

  const masters = [
    ...urls.filter(value => /master\.m3u8/i.test(value)),
    ...urls.filter(value => !/master\.m3u8/i.test(value)),
  ];
  if (!masters.length) throw new Error("HDStream4U playlist was not found");

  for (const master of [...new Set(masters)]) {
    try {
      const playlist = await fetchText(master, playerUrl);
      if (!playlist.trimStart().startsWith("#EXTM3U")) continue;
      const lines = playlist.split(/\r?\n/);
      const variants = [];
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].startsWith("#EXT-X-STREAM-INF:")) continue;
        const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/i)?.[1] || 0);
        const child = lines.slice(index + 1).find(line => line.trim() && !line.startsWith("#"));
        if (child) variants.push({ bandwidth, url: new URL(child.trim(), master).href });
      }
      variants.sort((a, b) => b.bandwidth - a.bandwidth);
      return variants[0]?.url || master;
    } catch (error) {
      console.error("HDStream4U server fallback failed:", error.message);
    }
  }

  throw new Error("No working HDStream4U playlist server");
}

function extractPlayers(page) {
  const normalized = decodeHtml(page).replace(/\\\//g, "/");
  return [...new Set(
    [...normalized.matchAll(/(?:https?:)?\/\/hdstream4u\.com\/file\/[a-z0-9_-]+/gi)]
      .map(result => result[0].startsWith("//") ? `https:${result[0]}` : result[0])
  )];
}

function filterEpisodePlayers(page, players, episode) {
  if (!episode || !players.length) return players;
  const normalized = decodeHtml(page).replace(/\\\//g, "/");
  const number = Number(episode);
  const padded = String(number).padStart(2, "0");
  const patterns = [
    new RegExp(`(?:episode|ep)[\\s_:#-]*0?${number}(?:\\D|$)`, "i"),
    new RegExp(`\\bE${padded}\\b`, "i"),
  ];

  const matched = players.filter(player => {
    const index = normalized.indexOf(player);
    if (index < 0) return false;
    const context = normalized.slice(Math.max(0, index - 1800), index + player.length + 1800);
    return patterns.some(pattern => pattern.test(context));
  });
  return matched.length ? matched : players;
}

async function getStreams({ title, year, type = "movie", season, episode, proxyBase }) {
  if (!title) return [];
  const matches = await findTitlePages({ title, year, type, season });
  if (!matches.length) return [];

  const streams = [];
  const seenPlayers = new Set();

  // Do not trust a single sitemap winner. Mirrors frequently contain several
  // similarly named pages and only one still carries live player links.
  for (const match of matches.slice(0, 8)) {
    let page;
    try {
      page = await fetchText(match.target);
    } catch {
      continue;
    }

    let players = extractPlayers(page);
    if (type === "tv") players = filterEpisodePlayers(page, players, episode);

    for (const player of players.slice(0, 8)) {
      if (seenPlayers.has(player)) continue;
      seenPlayers.add(player);
      try {
        const playlist = await resolvePlayer(player);
        streams.push({
          name: "HDStream4U",
          title: `${title}${type === "tv" ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : ""}`,
          url: `${proxyBase}/api/hdstream4u-proxy/master.m3u8?url=${encodeURIComponent(playlist)}`,
          quality: "Auto",
          streamType: "M3U8",
          provider: "HDStream4U",
          source: "Premium Source 16",
          pageUrl: match.target,
        });
        if (streams.length >= 3) return streams;
      } catch (error) {
        console.error("HDStream4U player failed:", player, error.message);
      }
    }
  }

  return streams;
}

module.exports = { getStreams, resolvePlayer, USER_AGENT };
