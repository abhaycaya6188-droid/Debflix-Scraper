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
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`HDStream4U upstream returned ${response.status}`);
  }

  return response.text();
}

async function currentDomain() {
  try {
    const response = await fetch(DOMAIN_SOURCE, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    const domains = await response.json();
    return String(domains.HDHUB4u || FALLBACK_DOMAIN).replace(/\/$/, "");
  } catch {
    return FALLBACK_DOMAIN;
  }
}

async function loadCatalogue() {
  if (catalogueCache && Date.now() < catalogueExpiresAt) return catalogueCache;

  const domain = await currentDomain();
  const index = await fetchText(`${domain}/sitemap.xml`);
  const sitemapUrls = [...index.matchAll(/<loc>([^<]*post-sitemap[^<]*\.xml)<\/loc>/gi)]
    .map(match => match[1].replace(/&amp;/g, "&"));

  const maps = await Promise.all(
    sitemapUrls.map(async sitemapUrl => {
      try {
        return await fetchText(sitemapUrl, domain + "/");
      } catch {
        return "";
      }
    })
  );

  catalogueCache = maps.flatMap(map =>
    [...map.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => match[1])
  );
  catalogueExpiresAt = Date.now() + 4 * 60 * 60 * 1000;
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
  const slug = decodeURIComponent(new URL(target).pathname);
  const wanted = words(title);
  const found = new Set(words(slug));
  let score = wanted.reduce((total, word) => total + (found.has(word) ? 15 : -20), 0);

  if (year && found.has(String(year))) score += 35;
  if (type === "tv" && season) {
    if (slug.includes(`season-${Number(season)}`)) score += 80;
    else score -= 80;
  } else if (slug.includes("full-movie")) {
    score += 20;
  }

  return score;
}

async function findTitlePage(options) {
  const catalogue = await loadCatalogue();
  return catalogue
    .map(target => ({ target, score: scoreUrl(target, options) }))
    .sort((a, b) => b.score - a.score)[0];
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

  const html = await fetchText(parsed.href, "https://hdstream4u.com/");
  const unpacked = unpackPlayer(html);
  const urls = [...unpacked.matchAll(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi)]
    .map(match => match[0].replace(/\\\//g, "/"));
  const master = urls.find(value => /master\.m3u8/i.test(value)) || urls[0];
  if (!master) throw new Error("HDStream4U playlist was not found");
  return master;
}

async function getStreams({ title, year, type = "movie", season, episode, proxyBase }) {
  const match = await findTitlePage({ title, year, type, season });
  if (!match || match.score < 10) return [];

  const page = await fetchText(match.target);
  let players = [...page.matchAll(/https?:\/\/hdstream4u\.com\/file\/[a-z0-9]+/gi)]
    .map(result => result[0]);
  players = [...new Set(players)];

  // TV pages usually identify each link near its episode heading. Keep the
  // requested episode when that association is available.
  if (type === "tv" && episode) {
    const episodePattern = new RegExp(
      `(?:episode|ep|e)[\\s_-]*0?${Number(episode)}[\\s\\S]{0,1500}?(https?:\\/\\/hdstream4u\\.com\\/file\\/[a-z0-9]+)`,
      "ig"
    );
    const episodePlayers = [...page.matchAll(episodePattern)].map(result => result[1]);
    if (episodePlayers.length) players = [...new Set(episodePlayers)];
  }

  const streams = [];
  for (const player of players.slice(0, 3)) {
    try {
      const playlist = await resolvePlayer(player);
      streams.push({
        name: "HDStream4U",
        title: `${title}${type === "tv" ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : ""}`,
        url: `${proxyBase}/api/hdstream4u-proxy?url=${encodeURIComponent(playlist)}`,
        quality: "Auto",
        streamType: "M3U8",
        provider: "HDStream4U",
        source: "Premium Source 16",
      });
    } catch (error) {
      console.error("HDStream4U player failed:", player, error.message);
    }
  }
  return streams;
}

module.exports = { getStreams, resolvePlayer, USER_AGENT };
