

const TMDB_API_KEY = "7bf6b8cf4d8a661e8a90ae825995471d";
console.log("RAILWAY FORCE REBUILD");
const http = require("http");
const url = require("url");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const { execSync } = require("child_process");
const { spawn } = require("child_process");
const db = require("./api/database");
const vidlinkHandler = require("./api/index");
const progress = require("./api/progress");
const vidking = require("./vidking");
const { getVideasySources } = require("./videasy");
const cinefreak = require("./cinefreak");
const cinecloud = require("./cinecloud");
const cinemm = require("./cinemm");
const fourKhdhub = require("./4khdhub");
const hdstream4u = require("./hdstream4u");
const ctg = require("./provider/ctg/engine");
const ctg2 = require("./provider/ctg/engine2");
const ctg3 = require("./provider/ctg/engine3");
const ctg4 = require("./provider/ctg/engine4");
const ctg5 = require("./provider/ctg/engine5");
const movixV2 =
  require("./movix-v2");
const NET_VERIFY = "https://net77.cc";
const NET_MAIN = "https://net77.cc";

const port = process.env.PORT || 3000;



const crypto = require("crypto");
let netmirrorCookie = "";
let netmirrorCookieTime = 0;

// -----------------------------------------------------
// NewTV helpers (matches Kotlin provider)
// -----------------------------------------------------

const newTvDomains = [
  "https://newtv.cfd",
  "https://newtv.cyou",
  "https://newtv.bond",
  "https://tv.imgcdn.kim",
];

function decodeBase64(value) {
  if (!value) return "";

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

function resolveApiUrl(player) {
  if (!player) return null;

  // already absolute
  if (player.api?.startsWith("http")) {
    return player.api;
  }

  // relative api
  if (player.api) {
    const base =
      newTvDomains.find(d => player.server?.startsWith(d)) ??
      newTvDomains[0];

    return base + player.api;
  }

  // fallback
  if (player.server) {
    return player.server.replace("/player.php", "/api.php");
  }

  return null;
}

function buildNewTvHeaders(player) {
  return {
    Accept: "application/json, text/plain, */*",
    Referer: player.referer || player.server || `${newTvDomains[0]}/`,
    Origin:
      (() => {
        try {
          return new URL(
            player.server || newTvDomains[0]
          ).origin;
        } catch {
          return newTvDomains[0];
        }
      })(),
    Ott: player.ott || "nf",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
    "X-Requested-With": "NetmirrorNewTV v1.0",
  };
}

const VIDKING_PROXY_PATH =
  "/api/vidking-hls-proxy";

const VIDKING_ALLOWED_HOSTS = [
  "ironbubble.site",
  "ironwallnet.net",
  "randomseg01.site",
  "checknews02.site",
  "cartlegion03.site",
  "lookcrew11.site",
  "diskphone12.site",
  "sandstorm13.site",
  "losangeles14.site",
];

function isAllowedVidKingHost(hostname) {
  const host = String(hostname || "")
    .toLowerCase();

  return VIDKING_ALLOWED_HOSTS.some(
    allowed =>
      host === allowed ||
      host.endsWith(`.${allowed}`)
  );
}

function normalizeHeaderObject(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (
      rawValue === undefined ||
      rawValue === null
    ) {
      continue;
    }

    const lower =
      String(key).toLowerCase();

    let name = key;

    if (lower === "referer") {
      name = "Referer";
    } else if (lower === "origin") {
      name = "Origin";
    } else if (
      lower === "user-agent" ||
      lower === "useragent"
    ) {
      name = "User-Agent";
    } else if (lower === "accept") {
      name = "Accept";
    }

    normalized[name] =
      String(rawValue);
  }

  return normalized;
}

function decodeVidKingHeaders(rawHeaders) {
  if (!rawHeaders) {
    return {};
  }

  try {
    return normalizeHeaderObject(
      JSON.parse(
        decodeURIComponent(
          String(rawHeaders)
        )
      )
    );
  } catch {
    return {};
  }
}

function getVidKingDefaultHeaders(targetUrl) {
  let origin = "";

  try {
    origin =
      new URL(targetUrl).origin;
  } catch {
    origin = "";
  }

  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/149.0.0.0 Safari/537.36",

    Accept: "*/*",

    Referer:
      "https://player.videasy.to/",

    Origin:
      "https://player.videasy.to",

    "Sec-Fetch-Dest":
      "empty",

    "Sec-Fetch-Mode":
      "cors",

    "Sec-Fetch-Site":
      origin.includes("vidking")
        ? "same-site"
        : "cross-site",
  };
}

function makeVidKingProxyUrl(
  absoluteUrl,
  headers
) {
  return (
    VIDKING_PROXY_PATH +
    "?url=" +
    encodeURIComponent(absoluteUrl) +
    "&headers=" +
    encodeURIComponent(
      JSON.stringify(headers || {})
    )
  );
}

function resolveHlsUrl(
  value,
  baseUrl
) {
  try {
    return new URL(
      value,
      baseUrl
    ).href;
  } catch {
    return value;
  }
}

function rewriteHlsPlaylist(
  playlist,
  playlistUrl,
  headers
) {
  return String(playlist)
    .split(/\r?\n/)
    .map(line => {
      const trimmed =
        line.trim();

      if (!trimmed) {
        return line;
      }

      /*
       * Rewrite URI="..." attributes used by:
       * EXT-X-KEY
       * EXT-X-MAP
       * EXT-X-MEDIA
       * EXT-X-I-FRAME-STREAM-INF
       */
      if (
        trimmed.startsWith("#") &&
        /URI="[^"]+"/i.test(line)
      ) {
        return line.replace(
          /URI="([^"]+)"/gi,
          (_, uri) => {
            const absolute =
              resolveHlsUrl(
                uri,
                playlistUrl
              );

            return (
              `URI="` +
              makeVidKingProxyUrl(
                absolute,
                headers
              ) +
              `"`
            );
          }
        );
      }

      /*
       * Leave normal HLS metadata untouched.
       */
      if (
        trimmed.startsWith("#")
      ) {
        return line;
      }

      /*
       * Rewrite child playlists,
       * media segments and subtitle files.
       */
      const absolute =
        resolveHlsUrl(
          trimmed,
          playlistUrl
        );

      return makeVidKingProxyUrl(
        absolute,
        headers
      );
    })
    .join("\n");
}

async function getNetmirrorCookie() {

  console.log("INITIALIZING NET11 SESSION");

  const res = await fetch(`${NET_MAIN}/home`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml",
      "Referer": `${NET_MAIN}/`,
    }
  });

  const headers = Object.fromEntries(res.headers.entries());

return headers;

  const match =
    setCookie.match(/t_hash_t=([^;]+)/);

  if (!match) {
    throw new Error("t_hash_t cookie not found");
  }

  const tHash = match[1];

  netmirrorCookie = tHash;
  netmirrorCookieTime = Date.now();

  return tHash;
}
  

http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "*");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

if (req.method === "OPTIONS") {
  res.statusCode = 200;
  return res.end();
}
    const parsed = url.parse(req.url, true);
const pathname = parsed.pathname;
const query = parsed.query;

if (pathname === "/api/tmdb-home") {
  const categories = {
    trendingMovies: "trending/movie/week",
    popularMovies: "movie/popular",
    nowPlaying: "movie/now_playing",
    upcoming: "movie/upcoming",
    topRatedMovies: "movie/top_rated",
    trendingTv: "trending/tv/week",
    popularTv: "tv/popular",
    topRatedTv: "tv/top_rated",
    airingToday: "tv/airing_today",
    onTheAir: "tv/on_the_air",
  };

  const entries = await Promise.all(
    Object.entries(categories).map(async ([name, path]) => {
      try {
        const target = `https://api.themoviedb.org/3/${path}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(target, { signal: AbortSignal.timeout(10000) });
        const data = response.ok ? await response.json() : { results: [] };
        return [name, data.results || []];
      } catch {
        return [name, []];
      }
    })
  );

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
  const home = Object.fromEntries(entries);
  home.trendingMovies = home.trendingMovies.length
    ? home.trendingMovies
    : (home.nowPlaying.length ? home.nowPlaying : home.topRatedMovies);
  home.popularMovies = home.popularMovies.length
    ? home.popularMovies
    : home.topRatedMovies;
  home.upcoming = home.upcoming.length
    ? home.upcoming
    : home.nowPlaying;
  home.trendingTv = home.trendingTv.length
    ? home.trendingTv
    : (home.popularTv.length ? home.popularTv : home.airingToday);
  home.topRatedTv = home.topRatedTv.length
    ? home.topRatedTv
    : home.popularTv;
  home.onTheAir = home.onTheAir.length
    ? home.onTheAir
    : home.airingToday;
  return res.end(JSON.stringify(home));
}

if (pathname === "/api/tmdb-details") {
  try {
    const type = query.type === "tv" ? "tv" : query.type === "movie" ? "movie" : "";
    const id = String(query.id || "");
    const season = String(query.season || "");
    const providers = query.providers === "1";

    if (!type || !/^\d+$/.test(id) || (season && !/^\d+$/.test(season))) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Invalid details request" }));
    }

    let path;
    if (season) {
      if (type !== "tv") throw new Error("Seasons are TV-only");
      path = `tv/${id}/season/${season}`;
    } else if (providers) {
      path = `${type}/${id}/watch/providers`;
    } else {
      path = `${type}/${id}`;
    }

    const target = new URL(`https://api.themoviedb.org/3/${path}`);
    target.searchParams.set("api_key", TMDB_API_KEY);
    if (!season && !providers) {
      target.searchParams.set(
        "append_to_response",
        type === "movie"
          ? "credits,videos,similar,recommendations,release_dates,images,external_ids"
          : "credits,videos,similar,recommendations,content_ratings,images,external_ids"
      );
    }

    const upstream = await fetch(target, { signal: AbortSignal.timeout(12000) });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    return res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Details relay failed", detail: String(error) }));
  }
}

function normalizeTitle(str = "") {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function pickBestCinefreakResult(results, movie, options = {}) {

    if (!results.length) return null;

    const type = options.type || "movie";
    const season = Number(options.season || 0);

    const tmdbTitle = normalizeTitle(
        type === "tv"
            ? movie.name
            : movie.title
    );

    const originalTitle = normalizeTitle(
        type === "tv"
            ? movie.original_name || ""
            : movie.original_title || ""
    );

    const year = Number(
        (
            type === "tv"
                ? movie.first_air_date
                : movie.release_date
        )?.substring(0, 4)
    );

    const scored = results.map(r => {

        const text = normalizeTitle(r.t);

        let score = 0;

        // Exact title
        if (text.includes(tmdbTitle))
            score += 120;

        // Original title
        if (
            originalTitle &&
            originalTitle !== tmdbTitle &&
            text.includes(originalTitle)
        )
            score += 80;

        // Release year
        const foundYear =
            Number(
                r.t.match(/\b(19|20)\d{2}\b/)?.[0]
            );

        if (foundYear && foundYear === year)
            score += 70;

        // TV season
        if (type === "tv" && season > 0) {

            const foundSeason =
                Number(
                    r.t.match(/season\s*(\d+)/i)?.[1]
                );

            if (foundSeason === season)
                score += 150;
            else if (foundSeason)
                score -= 120;
        }

        // Prefer proper releases
        if (/web series/i.test(r.t))
            score += 20;

        // Penalize extras
        if (/making/i.test(r.t))
            score -= 300;

        if (/challenge/i.test(r.t))
            score -= 300;

        if (/conversation/i.test(r.t))
            score -= 300;

        if (/documentary/i.test(r.t))
            score -= 300;

        return {
            ...r,
            score
        };

    });

    scored.sort((a, b) => b.score - a.score);

    console.log("\n========== CINEFREAK MATCH ==========");

    scored.forEach(r => {
        console.log(
            `${r.score} | ${r.t}`
        );
    });

    console.log(
        "SELECTED:",
        scored[0].t
    );

    console.log("=====================================\n");

    return scored[0];
}



    if (pathname === "/api/progress" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", () => {

        try {

            const data = JSON.parse(body);

            progress.saveProgress(data);

            res.setHeader(
                "Content-Type",
                "application/json"
            );

            res.end(
                JSON.stringify({
                    success: true
                })
            );

        } catch (e) {

            res.statusCode = 500;

            res.end(
                JSON.stringify({
                    success: false,
                    error: e.message
                })
            );

        }

    });

    return;

}

    if (pathname === "/api/test-dahmer-folder") {
      try {
        const r = await fetch("https://a.111477.xyz/movies/", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });

        const text = await r.text();

        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({
            status: r.status,
            length: text.length,
            preview: text.slice(0, 300),
          })
        );
      } catch (e) {
        return res.end(
          JSON.stringify({
            error: e.message,
          })
        );
      }
    }

if (pathname === "/api/test-videasy-new") {

  try {

    const tmdbId = query.id;

    if (!tmdbId) {
      return res.end(JSON.stringify({
        success: false,
        error: "Missing TMDB id"
      }));
    }

    // -----------------------
    // STEP 1 - Get Seed
    // -----------------------

    const seedRes = await fetch(
      `https://api.wingsdatabase.com/seed?mediaId=${tmdbId}`
    );

    const seedText = await seedRes.text();

return res.end(JSON.stringify({

    status: seedRes.status,

    headers: Object.fromEntries(seedRes.headers.entries()),

    body: seedText.substring(0,1000)

}, null, 2));

    if (!seedRes.ok || !seedJson.seed) {
      return res.end(JSON.stringify({
        success: false,
        stage: "seed",
        status: seedRes.status,
        response: seedJson
      }, null, 2));
    }

    const params = new URLSearchParams({

      title: query.title || "",

      mediaType:
        (query.type || "movie").toLowerCase(),

      year:
        query.year || "",

      tmdbId,

      imdbId:
        query.imdbId || "",

      seasonId:
        query.season || "1",

      episodeId:
        query.episode || "1",

      enc: "2",

      seed: seedJson.seed

    });

    const apiUrl =
      `https://api.wingsdatabase.com/cdn/sources-with-title?${params.toString()}`;

    // -----------------------
    // STEP 2 - Get Cipher
    // -----------------------

    const response = await fetch(apiUrl, {

      headers: {

        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36",

        "Referer":
          "https://player.videasy.to/",

        "Origin":
          "https://player.videasy.to"

      }

    });

    const body = await response.text();

    return res.end(JSON.stringify({

      success: true,

      stage: "cipher",

      seed: seedJson.seed,

      status: response.status,

      url: apiUrl,

      bodyLength: body.length,

      preview: body.substring(0, 500)

    }, null, 2));

  } catch (e) {

    return res.end(JSON.stringify({

      success: false,

      error: e.message,

      stack: e.stack

    }, null, 2));

  }

}


if (pathname === "/api/cinemm") {

  try {

    const id = query.id;

    const type = query.type || "movie";

    if (!id) {

      return res.end(JSON.stringify({

        success: false,

        error: "Missing TMDB id"

      }));

    }

    // -----------------------
    // TMDB Lookup
    // -----------------------

    const tmdbRes = await fetch(

      `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`

    );

    const media = await tmdbRes.json();

    const title =
      type === "tv"
        ? media.name
        : media.title;

    const year = (

      type === "tv"
        ? media.first_air_date
        : media.release_date

    )?.split("-")[0];

    if (!title) {

      return res.end(JSON.stringify({

        success: false,

        error: "Title not found"

      }));

    }

    // -----------------------
    // CineMM
    // -----------------------

    const streams = await cinemm.getStreams({

      title,

      year,

      type

    });

    return res.end(JSON.stringify({

      success: true,

      provider: "CineMM",

      streams

    }));

  } catch (e) {

    console.error(e);

    return res.end(JSON.stringify({
        success: false,
        message: e.message,
        stack: e.stack,
        cause: e.cause
    }, null, 2));

}

}

if (pathname === "/api/4khdhub") {

  try {
    res.setHeader(
  "Content-Type",
  "application/json"
);

    const id = query.id;
    const type = query.type || "movie";

    if (!id) {
      return res.end(JSON.stringify({
        success: false,
        error: "Missing TMDB id",
        streams: []
      }));
    }

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`
    );

    const media = await tmdbRes.json();

    const title =
      type === "tv"
        ? media.name
        : media.title;

    const year = (
      type === "tv"
        ? media.first_air_date
        : media.release_date
    )?.split("-")[0];

    if (!title) {
      return res.end(JSON.stringify({
        success: false,
        error: "Title not found",
        streams: []
      }));
    }

    const streams =
      await fourKhdhub.getStreams({
        title,
        year,
        type,
        season: query.season,
        episode: query.episode
      });

    return res.end(JSON.stringify({
      success: true,
      provider: "4KHDHub",
      title,
      year,
      streams
    }));

  } catch (e) {

    console.error("4KHDHUB:", e);

    return res.end(JSON.stringify({
      success: false,
      provider: "4KHDHub",
      error: e.message,
      stack: e.stack,
      streams: []
    }, null, 2));

  }

}




if (pathname === "/api/ctg") {

  try {

    

    const id = query.id;
    const type = query.type || "movie";

    if (!id) {

      return res.end(JSON.stringify({
        success: false,
        error: "Missing TMDB id"
      }));

    }

    // -----------------------
    // TMDB Lookup
    // -----------------------

    let title =
  String(query.title || "").trim();

let year =
  Number(query.year || 0);

if (!title) {

  const tmdbRes = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`
  );

  const media =
    await tmdbRes.json();

  title =
    type === "tv"
      ? media.name
      : media.title;

  year = Number(
    (
      type === "tv"
        ? media.first_air_date
        : media.release_date
    )?.split("-")[0]
  );

}

console.log("=== CTG REQUEST ===");
console.log("=== CTG SEARCH ===");

console.log({
  title,
  year,
  type,
  season: Number(query.season || 1),
  episode: Number(query.episode || 1)
});
    // -----------------------
    // CTG Search
    // -----------------------

    const searchQuery = {

  title,

  year,

  season: Number(query.season || 1),

  episode: Number(query.episode || 1),

  type

};

const r1 = ctg.search(searchQuery);
const r2 = ctg2.search(searchQuery);
const r3 = ctg3.search(searchQuery);
const r4 = ctg4.search(searchQuery);
const r5 = ctg5.search(searchQuery);

console.log("========== CTG ENGINES ==========");
console.log("Server 1 :", r1.length);
console.log("Server 2 :", r2.length);
console.log("Server 3 :", r3.length);
console.log("Server 4 :", r4.length);
console.log("Server 5 :", r5.length);


const results = [
    ...r1,
    ...r2,
    ...r3,
    ...r4,
    ...r5
];
results.sort((a, b) => b.score - a.score);

    console.log("CTG Results:", results.length);

if (results.length) {
    console.log(results[0]);
}

    if (!results.length) {

      return res.end(JSON.stringify({

        success: false,

        error: "No CTG match"

      }));

    }

    const streams = results.map(r => ({

      provider: "CTG",

      quality: r.quality || "Auto",

      url: r.url,

      codec: r.codec,

      language: r.language,

      size: r.size,

      source: r.source,

      filename: r.filename

    }));

    return res.end(JSON.stringify({

      success: true,

     provider: "CTG",

      streams

    }));

  }

  catch (e) {

    console.error(e);

    res.statusCode = 500;

    return res.end(JSON.stringify({

      success: false,

      error: e.message

    }));

  }

}

if (pathname === "/api/cinefreak-search") {

  try {

    const title = query.title;

    const results =
      await cinefreak.search(title);

    if (!results.length) {

      return res.end(JSON.stringify({
        success: false,
        error: "Nothing found"
      }));

    }

    const result =
    await cinefreak.resolve(results[0].l);

return res.end(
    JSON.stringify(result, null, 2)
);

if (!best) {
    return res.end(JSON.stringify({
        success: false,
        error: "No suitable match"
    }));
}

  } catch (e) {

    console.error(e);

    res.statusCode = 500;

    return res.end(JSON.stringify({
      success: false,
      error: e.message
    }));

  }

}

if (pathname === "/api/cinefreak") {

  try {

    const id = query.id;
    const type = query.type || "movie";

    if (!id) {
      return res.end(JSON.stringify({
        success: false,
        error: "Missing TMDB id"
      }));
    }

    const suppliedTitle = String(query.title || "").trim();
    const suppliedYear = String(query.year || "").match(/\b(19|20)\d{2}\b/)?.[0] || "";

    // The caller already has metadata. Prefer it so a transient TMDB reset
    // cannot make an otherwise healthy CineFreak result disappear.
    let movie;

    if (suppliedTitle) {
      movie = type === "tv"
        ? {
            name: suppliedTitle,
            original_name: suppliedTitle,
            first_air_date: suppliedYear ? `${suppliedYear}-01-01` : ""
          }
        : {
            title: suppliedTitle,
            original_title: suppliedTitle,
            release_date: suppliedYear ? `${suppliedYear}-01-01` : ""
          };
    } else {
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!tmdbRes.ok) {
        throw new Error(`TMDB HTTP ${tmdbRes.status}`);
      }

      movie = await tmdbRes.json();
    }

    const title =
      type === "tv"
        ? movie.name
        : movie.title;

    if (!title) {
      return res.end(JSON.stringify({
        success: false,
        error: "Title not found"
      }));
    }

    const results =
      await cinefreak.search(title);

    if (!results.length) {
      return res.end(JSON.stringify({
        success: false,
        error: "Nothing found"
      }));
    }

    const best = pickBestCinefreakResult(
    results,
    movie,
    {
        type,
        season: query.season,
        episode: query.episode
    }
);

if (!best) {

    return res.end(JSON.stringify({
        success: false,
        error: "No suitable CineFreak match"
    }));

}

const result =
    await cinefreak.resolve(best.l);

    return res.end(
      JSON.stringify(result)
    );

  } catch (e) {

    console.error(e);

    res.statusCode = 500;

    return res.end(JSON.stringify({
      success: false,
      error: e.message
    }));

  }

}

if (pathname === "/api/cinefreak/generate") {

  try {

    const id = query.id;

    if (!id) {
      return res.end(JSON.stringify({
        success: false,
        error: "Missing id"
      }));
    }

    const result =
      await cinecloud.generate(
        `https://new5.cinecloud.site/w/${id}`
      );

    return res.end(
      JSON.stringify(result)
    );

  } catch (e) {

    console.error(e);

    res.statusCode = 500;

    return res.end(JSON.stringify({
      success: false,
      error: e.message
    }));

  }

}

if (pathname === "/api/cinefreak/qualities") {

  try {

    const id = query.id;
    const type = query.type || "movie";

    if (!id) {
      return res.end(JSON.stringify({
        success: false,
        error: "Missing TMDB id"
      }));
    }

    // -----------------------
    // TMDB Lookup
    // -----------------------

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`
    );

    const movie = await tmdbRes.json();

    const title =
      type === "tv"
        ? movie.name
        : movie.title;

    if (!title) {
      return res.end(JSON.stringify({
        success: false,
        error: "Title not found"
      }));
    }

    // -----------------------
    // CineFreak Search
    // -----------------------

    const results =
      await cinefreak.search(title);

    if (!results.length) {
      return res.end(JSON.stringify({
        success: false,
        error: "Nothing found"
      }));
    }

    // -----------------------
    // Resolve Remaining Qualities
    // -----------------------


const best = pickBestCinefreakResult(
    results,
    movie,
    {
        type,
        season: query.season,
        episode: query.episode
    }
);

if (!best) {

    return res.end(JSON.stringify({
        success: false,
        error: "No suitable CineFreak match"
    }));

}

const result =
    await cinefreak.resolveQualities(best.l);

    return res.end(
      JSON.stringify(result)
    );

  } catch (e) {

    console.error(e);

    res.statusCode = 500;

    return res.end(JSON.stringify({
      success: false,
      error: e.message
    }));

  }

}

    if (pathname === "/api/videasy") {

  try {

    const result =
      await getVideasySources(query);

    // Android's source list only needs playback metadata. Videasy may attach
    // hundreds of subtitle objects to every quality and repeat the same list
    // again at the response root. Besides wasting heap, those objects do not
    // match the mobile DTO's string subtitle field and make Gson reject the
    // complete provider response. Keep this endpoint small and deterministic.
    const mobileStreams =
      Array.isArray(result.streams)
        ? result.streams.map(stream => {
            const {
              subtitles,
              ...playbackStream
            } = stream;
            return playbackStream;
          })
        : [];

    const mobileResult = {
      success: result.success,
      provider: result.provider,
      server: result.server,
      tmdbId: result.tmdbId,
      streams: mobileStreams,
      error: result.error,
    };

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(
      JSON.stringify(mobileResult)
    );

  } catch (e) {

    console.error(
      "VIDEASY ERROR:",
      e
    );

    res.statusCode = 500;

    return res.end(
      JSON.stringify({
        success: false,
        error: e.message,
      })
    );

  }

}


if (
  pathname ===
  "/api/vidking-hls-proxy"
) {
  try {
    const rawUrl =
      query.url;

    if (!rawUrl) {
      res.statusCode = 400;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      return res.end(
        JSON.stringify({
          success: false,
          error:
            "Missing VidKing url",
        })
      );
    }

    let targetUrl;

    try {
      targetUrl =
        decodeURIComponent(
          String(rawUrl)
        );
    } catch {
      targetUrl =
        String(rawUrl);
    }

    let target;

    try {
      target =
        new URL(targetUrl);
    } catch {
      res.statusCode = 400;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      return res.end(
        JSON.stringify({
          success: false,
          error:
            "Invalid VidKing URL",
        })
      );
    }

    if (
      target.protocol !== "https:"
    ) {
      res.statusCode = 403;

      return res.end(
        JSON.stringify({
          success: false,
          error:
            "Only HTTPS VidKing URLs are allowed",
        })
      );
    }

    if (
      !isAllowedVidKingHost(
        target.hostname
      )
    ) {
      res.statusCode = 403;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      return res.end(
        JSON.stringify({
          success: false,
          error:
            `VidKing host not allowed: ${target.hostname}`,
        })
      );
    }

    const returnedHeaders =
      decodeVidKingHeaders(
        query.headers
      );

    /*
     * Same precedence as Android:
     *
     * defaults
     * → provider-returned headers
     * → embedded/explicit headers
     *
     * Here query.headers is the final
     * explicit header object.
     */
    const requestHeaders = {
      ...getVidKingDefaultHeaders(
        targetUrl
      ),

      ...returnedHeaders,
    };

    if (req.headers.range) {
      requestHeaders.Range =
        req.headers.range;
    }

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () =>
          controller.abort(),
        20000
      );

    let upstream;

    try {
      upstream =
        await fetch(
          targetUrl,
          {
            headers:
              requestHeaders,

            redirect:
              "follow",

            signal:
              controller.signal,
          }
        );
    } finally {
      clearTimeout(
        timeoutId
      );
    }

    if (!upstream.ok) {
      const failureBody =
        await upstream.text();

      res.statusCode =
        upstream.status;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      return res.end(
        JSON.stringify({
          success: false,

          error:
            `VidKing upstream HTTP ${upstream.status}`,

          host:
            target.hostname,

          url:
            targetUrl,

          preview:
            failureBody.slice(
              0,
              300
            ),
        })
      );
    }

    const contentType =
      upstream.headers.get(
        "content-type"
      ) || "";

    const finalUrl =
      upstream.url ||
      targetUrl;

    const isPlaylist =
      contentType.includes(
        "application/vnd.apple.mpegurl"
      ) ||
      contentType.includes(
        "application/x-mpegurl"
      ) ||
      new URL(finalUrl)
        .pathname
        .toLowerCase()
        .endsWith(".m3u8");

    res.statusCode =
      upstream.status;

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "*"
    );

    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges"
    );

    res.setHeader(
      "Cache-Control",
      isPlaylist
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=300"
    );

    const acceptRanges =
      upstream.headers.get(
        "accept-ranges"
      );

    const contentRange =
      upstream.headers.get(
        "content-range"
      );

    const contentLength =
      upstream.headers.get(
        "content-length"
      );

    if (acceptRanges) {
      res.setHeader(
        "Accept-Ranges",
        acceptRanges
      );
    }

    if (contentRange) {
      res.setHeader(
        "Content-Range",
        contentRange
      );
    }

    if (
      contentLength &&
      !isPlaylist
    ) {
      res.setHeader(
        "Content-Length",
        contentLength
      );
    }

    if (isPlaylist) {
      const maxPlaylistBytes =
        2 * 1024 * 1024;

      if (
        Number(contentLength || 0) >
        maxPlaylistBytes
      ) {
        await upstream.body?.cancel();
        res.statusCode = 502;
        return res.end("VidKing playlist exceeds safety limit");
      }

      const reader =
        upstream.body?.getReader();
      const chunks = [];
      let received = 0;

      if (!reader) {
        res.statusCode = 502;
        return res.end("VidKing playlist body missing");
      }

      while (true) {
        const { done, value } =
          await reader.read();
        if (done) break;

        received += value.byteLength;
        if (received > maxPlaylistBytes) {
          await reader.cancel();
          res.statusCode = 502;
          return res.end("VidKing playlist exceeds safety limit");
        }
        chunks.push(Buffer.from(value));
      }

      const playlist =
        Buffer.concat(chunks, received)
          .toString("utf8");

      if (
        !playlist
          .trimStart()
          .startsWith("#EXTM3U")
      ) {
        res.statusCode = 502;

        res.setHeader(
          "Content-Type",
          "application/json"
        );

        return res.end(
          JSON.stringify({
            success: false,
            error:
              "VidKing returned an invalid HLS playlist",
            preview:
              playlist.slice(
                0,
                300
              ),
          })
        );
      }

      const rewritten =
        rewriteHlsPlaylist(
          playlist,
          finalUrl,
          returnedHeaders
        );

      res.setHeader(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

      return res.end(
        rewritten
      );
    }

    res.setHeader(
      "Content-Type",
      contentType ||
        "application/octet-stream"
    );

    if (
      upstream.body
    ) {
      const reader =
        upstream.body.getReader();

      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          break;
        }

        res.write(
          Buffer.from(value)
        );
      }

      return res.end();
    }

    const buffer =
      Buffer.from(
        await upstream.arrayBuffer()
      );

    return res.end(
      buffer
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    res.statusCode =
      message.includes(
        "aborted"
      )
        ? 504
        : 500;

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    return res.end(
      JSON.stringify({
        success: false,
        error:
          message.includes(
            "aborted"
          )
            ? "VidKing proxy timed out"
            : message,
      })
    );
  }
}

if (pathname === "/api/movix-vidmoly-resolve") {
  try {
    const embedUrl = String(query.url || "");
    const parsedEmbed = new URL(embedUrl);
    const embedHost = parsedEmbed.hostname.toLowerCase();

    if (!/(^|\.)vidmoly\.(biz|me)$/.test(embedHost)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ success: false, error: "Unsupported Vidmoly URL" }));
    }

    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
    const embedResponse = await fetch(parsedEmbed.href, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://movix.cash/",
        "User-Agent": userAgent,
      },
      redirect: "follow",
    });
    const html = await embedResponse.text();
    const patterns = [
      /sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /["'](https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*)["']/i,
    ];
    let streamUrl = "";
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        streamUrl = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&#x2F;/gi, "/")
          .replace(/&#47;/g, "/")
          .replace(/\\\//g, "/");
        break;
      }
    }

    if (!embedResponse.ok || !streamUrl) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        success: false,
        error: !embedResponse.ok
          ? `Vidmoly page HTTP ${embedResponse.status}`
          : "No Vidmoly HLS stream found",
      }));
    }

    const proxyBase = "https://debflix-scraper-production.up.railway.app";
    const playableUrl =
      `${proxyBase}/api/movix-hls-proxy?url=${encodeURIComponent(streamUrl)}` +
      `&referer=${encodeURIComponent(parsedEmbed.origin + "/")}`;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({
      success: true,
      stream: {
        url: playableUrl,
        streamType: "M3U8",
        host: new URL(streamUrl).hostname,
        referer: parsedEmbed.origin + "/",
      },
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ success: false, error: e.message || String(e) }));
  }
}

if (pathname === "/api/movix-hls-proxy") {

  try {

    const rawUrl = query.url;

    if (!rawUrl) {

      res.statusCode = 400;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing url"
        })
      );

    }

    let targetUrl;

    try {

      targetUrl =
        decodeURIComponent(
          String(rawUrl)
        );

    } catch {

      targetUrl =
        String(rawUrl);

    }

    let target;

    try {

      target =
        new URL(targetUrl);

    } catch {

      res.statusCode = 400;

      return res.end(
        JSON.stringify({
          success: false,
          error: "Invalid Movix URL"
        })
      );

    }

    /*
     * Only allow known Movix media hosts.
     * This prevents the route becoming an open proxy.
     */
    const allowedHosts = [
      "finepulfe.xyz",
      "vmeas.cloud",
      "vmwesa.online",
      "vmwesa.com",
    ];

    const allowed =
      allowedHosts.some(
        host =>
          target.hostname === host ||
          target.hostname.endsWith(
            `.${host}`
          )
      );

    if (!allowed) {

      res.statusCode = 403;

      return res.end(
        JSON.stringify({
          success: false,
          error:
            `Movix host not allowed: ${target.hostname}`
        })
      );

    }

    const requestHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/149.0.0.0 Safari/537.36",

      Accept: "*/*",

      Referer:
        String(query.referer || "https://cinestream.info/"),
    };

    /*
     * Forward Range header for TS/video segments.
     */
    if (req.headers.range) {
      requestHeaders.Range =
        req.headers.range;
    }

    console.log(
      "MOVIX HLS PROXY:",
      targetUrl
    );

    const upstream =
      await fetch(
        targetUrl,
        {
          headers: requestHeaders,
          redirect: "follow",
        }
      );

    const contentType =
      upstream.headers.get(
        "content-type"
      ) || "";

    const isPlaylist =
      contentType.includes(
        "application/vnd.apple.mpegurl"
      ) ||
      contentType.includes(
        "application/x-mpegurl"
      ) ||
      target.pathname
        .toLowerCase()
        .endsWith(".m3u8");

    if (!upstream.ok) {

      const failureBody =
        await upstream.text();

      res.statusCode =
        upstream.status;

      res.setHeader(
        "Content-Type",
        "application/json"
      );

      return res.end(
        JSON.stringify({
          success: false,
          error:
            `Movix upstream HTTP ${upstream.status}`,
          preview:
            failureBody.slice(0, 300)
        })
      );

    }

    /*
     * Railway public URL.
     * Keep this Movix-only.
     */
    const proxyBase =
      "https://debflix-scraper-production.up.railway.app";

    const buildProxyUrl =
      mediaUrl =>
        `${proxyBase}/api/movix-hls-proxy?url=${encodeURIComponent(
          mediaUrl
        )}&referer=${encodeURIComponent(requestHeaders.Referer)}`;

    if (isPlaylist) {

      const playlist =
        await upstream.text();

      if (
        !playlist
          .trimStart()
          .startsWith("#EXTM3U")
      ) {

        res.statusCode = 502;

        res.setHeader(
          "Content-Type",
          "application/json"
        );

        return res.end(
          JSON.stringify({
            success: false,
            error:
              "Movix upstream did not return an HLS playlist",
            preview:
              playlist.slice(0, 300)
          })
        );

      }

      const playlistBase =
        new URL(
          ".",
          targetUrl
        ).href;

      const cleanedPlaylist =
  playlist
    .split(/\r?\n/)
    .filter(line => {
      const trimmed =
        line.trim();

      return !/^#EXT-X-MEDIA:TYPE=SUBTITLES/i.test(
        trimmed
      );
    })
    .map(line =>
      line.replace(
        /,SUBTITLES="[^"]*"/gi,
        ""
      )
    )
    .join("\n");

const rewrittenLines =
  cleanedPlaylist
    .split(/\r?\n/)
    .map(line => {

            const trimmed =
              line.trim();

            if (!trimmed) {
              return line;
            }

            /*
             * Rewrite URI="..."
             * Used by audio, subtitles and encryption keys.
             */
            if (
              trimmed.startsWith("#") &&
              line.includes('URI="')
            ) {

              return line.replace(
                /URI="([^"]+)"/g,
                (_, uriValue) => {

                  const fullUrl =
                    new URL(
                      uriValue,
                      targetUrl
                    ).href;

                  return (
                    `URI="` +
                    buildProxyUrl(
                      fullUrl
                    ) +
                    `"`
                  );

                }
              );

            }

            /*
             * Leave normal HLS tags unchanged.
             */
            if (
              trimmed.startsWith("#")
            ) {
              return line;
            }

            /*
             * Rewrite media playlist,
             * video segment, subtitle or key URL.
             */
            const fullUrl =
              new URL(
                trimmed,
                playlistBase
              ).href;

            return buildProxyUrl(
              fullUrl
            );

          })
          .join("\n");

      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      return res.end(
        rewrittenLines
      );

    }

    /*
     * Binary files:
     * TS, VTT, keys, MP4 fragments, etc.
     */
    const buffer =
      Buffer.from(
        await upstream.arrayBuffer()
      );

    res.statusCode =
      upstream.status;

    res.setHeader(
      "Content-Type",
      contentType ||
      "application/octet-stream"
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    const contentLength =
      upstream.headers.get(
        "content-length"
      );

    const contentRange =
      upstream.headers.get(
        "content-range"
      );

    const acceptRanges =
      upstream.headers.get(
        "accept-ranges"
      );

    if (contentLength) {

      res.setHeader(
        "Content-Length",
        contentLength
      );

    }

    if (contentRange) {

      res.setHeader(
        "Content-Range",
        contentRange
      );

    }

    if (acceptRanges) {

      res.setHeader(
        "Accept-Ranges",
        acceptRanges
      );

    }

    return res.end(
      buffer
    );

  } catch (e) {

    console.error(
      "MOVIX HLS PROXY ERROR:",
      e
    );

    res.statusCode = 500;

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(
      JSON.stringify({
        success: false,
        error:
          e.message ||
          "Unknown Movix proxy error"
      })
    );

  }

}

if (
  pathname === "/api/movix-v2"
) {
  res.setHeader(
    "Content-Type",
    "application/json"
  );

  try {
    const tmdbId =
      query.id;

    const type =
      query.type || "movie";

    const season =
      query.season;

    const episode =
      query.episode;

    if (!tmdbId) {
      res.statusCode = 400;

      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing TMDB id",
          streams: [],
        })
      );
    }

    const result =
      await movixV2.getStreams({
        tmdbId,
        type,
        season,
        episode,
      });

    return res.end(
      JSON.stringify(result)
    );
  } catch (error) {
    console.error(
      "MOVIX V2 ERROR:",
      error
    );

    res.statusCode = 500;

    return res.end(
      JSON.stringify({
        success: false,
        provider: "Movix",
        error:
          error?.message ||
          String(error),
        streams: [],
      })
    );
  }
}



if (pathname === "/api/hdstream4u") {
  res.setHeader("Content-Type", "application/json");

  try {
    const id = String(query.id || "");
    const type = query.type === "tv" ? "tv" : "movie";
    if (!/^\d+$/.test(id)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, streams: [], error: "Invalid TMDB id" }));
    }

    let title = String(query.title || "").trim();
    let year = String(query.year || "").trim();
    if (!title) {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`,
        { signal: AbortSignal.timeout(12_000) }
      );
      if (!tmdbResponse.ok) throw new Error(`TMDB returned ${tmdbResponse.status}`);
      const media = await tmdbResponse.json();
      title = type === "tv" ? media.name : media.title;
      const date = type === "tv" ? media.first_air_date : media.release_date;
      year = String(date || "").slice(0, 4);
    }
    const proxyBase = `https://${req.headers.host || "oracle.debflicks.com"}`;
    const streams = await hdstream4u.getStreams({
      title,
      year,
      type,
      season: query.season,
      episode: query.episode,
      proxyBase,
    });

    return res.end(JSON.stringify({ success: true, provider: "HDStream4U", streams }));
  } catch (error) {
    console.error("HDSTREAM4U ERROR:", error);
    res.statusCode = 502;
    return res.end(JSON.stringify({
      success: false,
      provider: "HDStream4U",
      streams: [],
      error: error?.message || String(error),
    }));
  }
}

if (pathname.startsWith("/api/hdstream4u-proxy")) {
  try {
    const target = new URL(String(query.url || ""));
    if (!/(^|\.)(hdstream4u\.com|acek-cdn\.com)$/i.test(target.hostname)) {
      res.statusCode = 403;
      return res.end("Unsupported HDStream4U host");
    }

    const upstream = await fetch(target, {
      headers: {
        Accept: "*/*",
        Origin: "https://hdstream4u.com",
        Referer: "https://hdstream4u.com/",
        "User-Agent": hdstream4u.USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      res.statusCode = upstream.status;
      return res.end(`HDStream4U upstream returned ${upstream.status}`);
    }

    const isPlaylist = target.pathname.toLowerCase().endsWith(".m3u8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", isPlaylist ? "no-store" : "public, max-age=3600");

    if (isPlaylist) {
      const body = Buffer.from(await upstream.arrayBuffer());
      const proxyBase = `https://${req.headers.host || "oracle.debflicks.com"}`;
      const makeProxyUrl = absolute => {
        const extension = new URL(absolute).pathname.match(/\.(m3u8|ts|aac|vtt|key)$/i)?.[0] || ".bin";
        return `${proxyBase}/api/hdstream4u-proxy/media${extension}?url=${encodeURIComponent(absolute)}`;
      };
      const rewritten = body.toString("utf8").split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
            const absolute = new URL(uri, target).href;
            return `URI="${makeProxyUrl(absolute)}"`;
          });
        }
        const absolute = new URL(trimmed, target).href;
        return makeProxyUrl(absolute);
      }).join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.end(rewritten);
    }

    // The provider prefixes MPEG-TS segments with a complete 1x1 PNG. Strip
    // that tiny prefix, then stream each segment immediately. Buffering the
    // complete 2-5 MB segment here caused 30-60 second player startup delays.
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("HDStream4U returned no media body");

    let prefix = Buffer.alloc(0);
    let prefixHandled = false;
    res.setHeader("Content-Type", "video/mp2t");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = Buffer.from(value);

      if (!prefixHandled) {
        prefix = Buffer.concat([prefix, chunk]);
        if (prefix.length < 8) continue;

        if (prefix.subarray(0, 8).equals(pngSignature)) {
          const iend = prefix.indexOf(Buffer.from("IEND"));
          if (iend < 0) continue;
          chunk = prefix.subarray(iend + 8);
        } else {
          chunk = prefix;
        }
        prefix = Buffer.alloc(0);
        prefixHandled = true;
      }

      if (chunk.length) res.write(chunk);
    }
    return res.end();
  } catch (error) {
    console.error("HDSTREAM4U PROXY ERROR:", error);
    res.statusCode = 502;
    return res.end("HDStream4U proxy failed");
  }
}

if (pathname === "/api/hls-proxy") {

  try {

    const playlistUrl =
      query.url;

    if (!playlistUrl) {
      res.statusCode = 400;

      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing url"
        })
      );
    }

    console.log("HLS PROXY:");
    console.log(playlistUrl);

    const response =
      await fetch(
        decodeURIComponent(playlistUrl),
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
            "Referer":
              "https://www.vidking.net/",
            "Origin":
              "https://www.vidking.net"
          }
        }
      );

    const contentType =
      response.headers.get("content-type") || "";

    console.log(
      "CONTENT:",
      contentType
    );
    if (
      contentType.includes("application/vnd.apple.mpegurl") ||
      playlistUrl.includes(".m3u8")
    ) {

      const text = await response.text();

const base = "https://oracle.debflicks.com";

const originalUrl = decodeURIComponent(playlistUrl);

const playlistBase =
  originalUrl.substring(
    0,
    originalUrl.lastIndexOf("/") + 1
  );

const rewritten = text
  // rewrite AES key
  .replace(
    /URI="([^"]+)"/g,
    (_, key) => {
      const full =
        key.startsWith("http")
          ? key
          : new URL(key, playlistUrl).href;

      return `URI="${base}/api/hls-proxy?url=${encodeURIComponent(full)}"`;
    }
  )

  // rewrite absolute URLs
  .replace(
  /(https?:\/\/[^\s"]+)/g,
  (match) => {

    // already proxied
    if (
      match.startsWith(
        "https://oracle.debflicks.com/api/hls-proxy"
      )
    ) {
      return match;
    }

    return `${base}/api/hls-proxy?url=${encodeURIComponent(match)}`;
  }
)

  // rewrite relative ts/m3u8
.replace(
  /^([^#\n][^\n]*)$/gm,
  (line) => {

    if (!line.trim()) {
      return line;
    }

    if (line.startsWith(base)) {
      return line;
    }

    const full =
      line.startsWith("http")
        ? line
        : new URL(line, playlistBase).href;

    return `${base}/api/hls-proxy?url=${encodeURIComponent(full)}`;
  }
);

res.setHeader(
  "Content-Type",
  "application/vnd.apple.mpegurl"
);

res.setHeader(
  "Access-Control-Allow-Origin",
  "*"
);

return res.end(rewritten);
    }

        const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.setHeader(
      "Content-Type",
      contentType || "application/octet-stream"
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    return res.end(buffer);

  } catch (e) {

    console.error(
      "HLS PROXY ERROR:",
      e
    );

    res.statusCode = 500;

    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );

  }

}
if (pathname === "/api/test-seed") {

  try {

    const seed =
      await vidking.getSeed(
        Number(query.id || 157336)
      );

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(
      JSON.stringify({
        success: true,
        seed
      })
    );

  } catch (e) {

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );

  }

}
if (pathname === "/api/test-cdn") {

  try {

    const seed =
  await vidking.getSeed(
    Number(query.id || 157336)
  );

const result =
  await vidking.fetchEncrypted("cdn", {

    tmdbId: Number(query.id || 157336),

    mediaType: "movie",

    title: "",

    year: "",

    imdbId: "",

    seasonId: 1,

    episodeId: 1,

    seed

  });
    const json =
    vidking.Df(
        result.encrypted,
        result.seed,
        Number(query.id || 157336)
    );

return res.end(json);

  } catch (e) {

    return res.end(e.message);

}
}

if (pathname === "/api/vidking") {

  try {

    const result = await vidking.resolve({

      title: query.title || "",
      mediaType: query.type || "movie",
      year: query.year || "",
      tmdbId: Number(query.id),
      imdbId: query.imdbId || "",
      seasonId: Number(query.season || 1),
      episodeId: Number(query.episode || 1)

    });

    const streams = [];
    const subtitles = [];

    if (Array.isArray(result.sources)) {

      for (const source of result.sources) {

        if (!source.url) continue;

        streams.push({

          provider: "VidKing",
          quality: source.quality || "Auto",

          // The CDN rejects direct phone requests even with the correct
          // Referer/Origin. Keep playlist, child-playlist, key and segment
          // requests on the bounded allowlisted proxy instead.
          url:
            "https://debflix-scraper-production.up.railway.app" +
            makeVidKingProxyUrl(
              source.url,
              getVidKingDefaultHeaders(source.url)
            ),

          // These are required by ironbubble for both the master playlist and
          // its child playlists/segments. Android forwards proxyHeaders to MPV.
          proxyHeaders: getVidKingDefaultHeaders(source.url),

          type: "hls"

        });

      }

    }

    if (Array.isArray(result.subtitles)) {

      for (const sub of result.subtitles) {

        if (!sub.url) continue;

        subtitles.push({

          language:
            sub.language ||
            sub.label ||
            "Unknown",

          url: sub.url,

          type:
            sub.format ||
            "vtt"

        });

      }

    }

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(

      JSON.stringify({

        success: true,

        provider: "VidKing",

        streams,

        subtitles

      })

    );

  } catch (e) {

    console.error("VIDKING:", e);

    res.statusCode = 500;

    return res.end(

      JSON.stringify({

        success: false,

        error: e.message

      })

    );

  }

}

    if (pathname === "/api/vixsrc") {
  try {
    const query = url.parse(req.url, true).query;

    const id = query.id;
    const season = query.s;
    const episode = query.e;

    if (!id) {
      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing TMDB id"
        })
      );
    }

    let apiUrl;

    if (season && episode) {
      apiUrl = `https://vixsrc.to/api/tv/${id}/${season}/${episode}`;
    } else {
      apiUrl = `https://vixsrc.to/api/movie/${id}`;
    }

    const apiRes = await fetch(apiUrl, {


      headers: {
        Referer: "https://vixsrc.to/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const body = await apiRes.text();

console.log("REQUESTED:", apiUrl);
console.log("FINAL URL:", apiRes.url);
console.log("STATUS:", apiRes.status);
console.log("BODY:", body.substring(0, 500));

console.log("VIXSRC STATUS:", apiRes.status);
console.log("VIXSRC BODY:", body.substring(0, 500));

const apiJson = JSON.parse(body);

    if (!apiJson?.src) {
      return res.end(
        JSON.stringify({
          success: false,
          error: "No src returned"
        })
      );
    }

    const embedUrl =
      "https://vixsrc.to" + apiJson.src;

    const embedRes = await fetch(embedUrl, {
      headers: {
        Referer: "https://vixsrc.to/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await embedRes.text();

    const playlistMatch = html.match(
  /url:\s*'([^']+playlist[^']*)'/
);

    const tokenMatch = html.match(
      /'token':\s*'([^']+)'/
    );

    const expiresMatch = html.match(
      /'expires':\s*'([^']+)'/
    );

    if (
      !playlistMatch ||
      !tokenMatch ||
      !expiresMatch
    ) {
      return res.end(
        JSON.stringify({
          success: false,
          error: "Failed extracting playlist"
        })
      );
    }

    const separator =
  playlistMatch[1].includes("?") ? "&" : "?";

const stream =
  `${playlistMatch[1]}${separator}token=${tokenMatch[1]}&expires=${expiresMatch[1]}&h=1`;

    const proxied =
  `https://debflix-scraper-production.up.railway.app/api/hls-proxy?url=${encodeURIComponent(stream)}`;

return res.end(
  JSON.stringify({
    success: true,
    provider: "VixSrc",
    stream: proxied
  })
);
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );
  }
}
if (pathname === "/api/dahmer") {
  try {
    const id = url.parse(req.url, true).query.id;

    if (!id) {
      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing TMDB id"
        })
      );
    }

    const tmdbKey = process.env.TMDB_API_KEY;

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbKey}`
    );

    const movie = await tmdbRes.json();

    const title = movie.title
      ?.replace(/[:]/g, "")
      .replace(/[?]/g, "")
      .replace(/[']/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const year =
      movie.release_date?.split("-")[0];

    const folderUrl =
      `https://a.111477.xyz/movies/${encodeURIComponent(
        `${title} (${year})`
      )}/`;

    const dirRes = await fetch(folderUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await dirRes.text();

    const regex =
      /href=['"]([^'"]+\.(?:mkv|mp4|avi|webm))['"]/gi;

    const streams = [];

    for (const match of html.matchAll(regex)) {
      const file = decodeURIComponent(match[1]);

      streams.push({
        provider: "Dahmer",
        quality:
          file.match(/(2160p|1080p|720p)/i)?.[0] ||
          "Auto",
        url: `https://a.111477.xyz${file}`
      });
    }

    return res.end(
      JSON.stringify({
        success: true,
        streams
      })
    );
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );
  }
}

    if (pathname === "/api/dahmer-tv") {
  try {
    const query = url.parse(req.url, true).query;

    const id = query.id;
    const season = query.season || "1";
    const episode = query.episode;

    if (!id) {
      return res.end(
        JSON.stringify({
          success: false,
          error: "Missing TMDB id"
        })
      );
    }

    const tmdbKey = process.env.TMDB_API_KEY;

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbKey}`
    );

    const show = await tmdbRes.json();

    const title = show.name
      ?.replace(/[:]/g, "")
      .replace(/[?]/g, "")
      .replace(/[']/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const seasonUrl =
      `https://a.111477.xyz/tvs/${encodeURIComponent(title)}/Season%20${season}/`;

    const seasonRes = await fetch(seasonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await seasonRes.text();

    const files = [
      ...html.matchAll(
        /href=['"]([^'"]+\.(?:mkv|mp4|avi|webm))['"]/gi
      ),
    ].map(m => decodeURIComponent(m[1]));

    let matchedFiles = files;

    if (episode) {
      const tag =
        `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;

      matchedFiles = files.filter(file =>
        file.includes(tag)
      );
    }

    const streams = matchedFiles.map(file => ({
      provider: "Dahmer",
      quality:
        file.match(/(2160p|1080p|720p)/i)?.[0] || "Auto",
      url: `https://a.111477.xyz${file}`
    }));

    return res.end(
      JSON.stringify({
        success: true,
        streams
      })
    );
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );
  }
}


if (pathname === "/api/test-home") {

   const r = await fetch(`${NET_MAIN}/home`, {
        headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36"
        }
    });

    return res.end(JSON.stringify({
        status: r.status,
        headers: Object.fromEntries(r.headers.entries())
    }, null, 2));
}


if (pathname === "/api/netmirror") {

  
  console.log("========== NETMIRROR ==========");
  try {
    const query = url.parse(req.url, true).query;

    const title = query.title;
const season = query.season || "1";
const episode = query.episode || "1";

let tHash;

try {
    tHash = await getNetmirrorCookie();
    console.log("COOKIE:", tHash);
} catch (e) {
  console.error("VERIFY FETCH ERROR:");
  console.error(e);
  console.error("CAUSE:", e.cause);
  throw e;
}

    const searchUrl =
  `${NET_MAIN}/search.php?s=${encodeURIComponent(title)}&t=${Math.floor(Date.now() / 1000)}`;
console.log("SEARCH URL:", searchUrl);

const searchRes = await fetch(searchUrl, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",

   "Referer": `${NET_MAIN}/home`,

    "Cookie": `t_hash_t=${tHash}; hd=on; ott=nf`
  }
});

const body = await searchRes.text();

console.log("SEARCH BODY:");
console.log(body);


const search = JSON.parse(body);

console.log("SEARCH JSON:");
console.log(JSON.stringify(search, null, 2));

const first =
  search.searchResult?.[0];

console.log("FIRST RESULT:");
console.log(first);

if (!first) {
    return res.end(
        JSON.stringify({
            success: false
        })
    );
}

    const detailsUrl =
  `${NET_MAIN}/post.php?id=${first.id}&t=${Math.floor(Date.now() / 1000)}`;
console.log("POST URL:", detailsUrl);

console.log("COOKIE TYPE:", typeof tHash);
console.log("COOKIE VALUE:", tHash);
console.log("POST COOKIE:");
console.log(`t_hash_t=${tHash}; hd=on; ott=nf`);
const detailsRes = await fetch(detailsUrl, {
  headers: {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  "Referer": `${NET_MAIN}/home`,
  "Accept": "application/json, text/plain, */*",
  "Cookie": `t_hash_t=${tHash}; hd=on; ott=nf`
}
});

console.log("POST STATUS:", detailsRes.status);
console.log("POST SET-COOKIE:", detailsRes.headers.get("set-cookie"));
const detailsBody = await detailsRes.text();

console.log("POST BODY:");
console.log(detailsBody);

const details = JSON.parse(detailsBody);
console.log("DETAIL TYPE:", details.type);
console.log("DETAIL TITLE:", details.title);
console.log("SEARCH TITLE:", first.t);


console.log("DETAILS JSON:");
console.log(JSON.stringify(details, null, 2));

console.log("SEASONS:");
console.log(details.season);

    // -------------------------------
// MOVIE
// -------------------------------

let selectedEpisode;

return res.end(JSON.stringify({
  success: true,
  debug: {
    search: first,
    details: details
  }
}));

// -------------------------------
// NEW NET11 FLOW
// -------------------------------

const playRes = await fetch(
  `${NET_MAIN}/play.php`,
  {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
      "Referer": `${NET_MAIN}/home`,
      "Origin": NET_MAIN,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type":
        "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": `t_hash_t=${tHash}; hd=on; ott=nf`
    },
    body: new URLSearchParams({
      id: selectedEpisode.id
    })
  }
);

const playText = await playRes.text();

console.log("PLAY:");
console.log(playText);

const play = JSON.parse(playText);

if (!play.h) {
  throw new Error("play.php returned no token");
}

const token = play.h.replace(/^in=/, "");

const parts = token.split("::");

if (parts.length < 3) {
  throw new Error("Invalid play token");
}

const tm = parts[2];

const playlistUrl =
  `${NET_MAIN}/playlist.php` +
  `?id=${selectedEpisode.id}` +
  `&t=${encodeURIComponent(first.t)}` +
  `&tm=${tm}` +
  `&h=${encodeURIComponent(token)}`;

console.log("PLAYLIST URL:");
console.log(playlistUrl);

const playlistRes = await fetch(
  playlistUrl,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
      "Referer":
        `${NET_MAIN}/play.php?id=${selectedEpisode.id}&in=${token}`
    }
  }
);

const playlistText =
  await playlistRes.text();

console.log("PLAYLIST:");
console.log(playlistText);

const playlist =
  JSON.parse(playlistText);

if (
  !playlist.length ||
  !playlist[0].sources?.length
) {
  throw new Error("No playlist sources");
}

const source =
  playlist[0].sources[0];

const stream =
  source.file.startsWith("http")
    ? source.file
    : `${NET_MAIN}${source.file}`;
return res.end(
  JSON.stringify({
    success: true,
    url: stream,
    referer: `${NET_MAIN}/play.php?id=${selectedEpisode.id}&in=${token}`,
    episode: selectedEpisode.t
  })
);

    
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );
  }
}

if (pathname === "/api/test-key") {
  
  try {
    const r = await fetch(
      "https://sc-u7-01.vix-content.net/storage/enc.key",
      {
        headers: {
          Referer: "https://vixsrc.to/",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const buf = Buffer.from(
      await r.arrayBuffer()
    );

    res.setHeader(
      "Content-Type",
      "application/octet-stream"
    );

    return res.end(buf);
  } catch (e) {
    return res.end(e.message);
  }
}

if (pathname === "/api/test-playlist") {
  try {
    const playlistUrl =
      url.parse(req.url, true).query.url;

    if (!playlistUrl) {
      return res.end("missing url");
    }

    const r = await fetch(playlistUrl, {
      headers: {
        Referer: "https://vixsrc.to/",
        "User-Agent": "Mozilla/5.0"
      }
    });

   const text = await r.text();

const tunnel =
"https://oracle.debflicks.com";

let rewritten = text;

// nested playlists
rewritten = rewritten.replace(
  /https:\/\/vixsrc\.to\/playlist[^\s"]+/g,
  (match) =>
    `${tunnel}/api/test-playlist?url=${encodeURIComponent(match)}`
);





// encryption key
rewritten = rewritten.replace(
  /URI="\/storage\/enc\.key"/g,
  `URI="${tunnel}/api/test-key"`
);

// TS fragments
rewritten = rewritten.replace(
  /https:\/\/sc-[^\s"]+\.ts[^\s"]*/g,
  (match) =>
    `${tunnel}/api/hls-proxy?url=${encodeURIComponent(match)}`
);

rewritten = rewritten.replace(
  /URI="([^"]+)"/g,
  (_, key) => {

    const keyUrl =
      key.startsWith("http")
        ? key
        : new URL(key, playlistUrl).href;

    return `URI="${tunnel}/api/hls-proxy?url=${encodeURIComponent(keyUrl)}"`;
  }
);

res.setHeader(
  "Content-Type",
  "application/vnd.apple.mpegurl"
);

return res.end(rewritten);

  } catch (e) {
    return res.end(e.message);
  }
}
 
if (pathname === "/api/test-video") {
  try {
    const videoUrl =
      url.parse(req.url, true).query.url;

    const r = await fetch(
      decodeURIComponent(videoUrl),
      {
        headers: {
          Referer: "https://vixsrc.to/",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const text = await r.text();

    const contentType =
  r.headers.get("content-type") || "";

if (
  contentType.includes("video") ||
  videoUrl.includes(".ts")
) {
  const buf = Buffer.from(
    await r.arrayBuffer()
  );

  res.setHeader(
    "Content-Type",
    contentType
  );

  return res.end(buf);
}

    res.setHeader(
      "Content-Type",
      "text/plain"
    );

    return res.end(text);
  } catch (e) {
    return res.end(e.message);
  }
}

if (pathname === "/api/test-netmirror-cookie") {
  try {
    const cookie = await getNetmirrorCookie();
    

    return res.end(
      JSON.stringify({
        success: true,
        cookie
      })
    );
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        error: e.message
      })
    );
  }
}


return vidlinkHandler(req, res);

})
.listen(process.env.PORT || 3000, () => {

    console.log(
        `Server running on port ${process.env.PORT || 3000}`
    );

});
