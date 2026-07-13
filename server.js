
const TMDB_API_KEY = "7bf6b8cf4d8a661e8a90ae825995471d";
console.log("RAILWAY FORCE REBUILD");
const http = require("http");
const url = require("url");
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
const ctg = require("./provider/ctg/engine");
const ctg2 = require("./provider/ctg/engine2");
const ctg3 = require("./provider/ctg/engine3");
const ctg4 = require("./provider/ctg/engine4");
const NET_MAIN =
  process.env.NETMIRROR_DOMAIN ||
  "https://net52.cc";
const NET_VERIFY =
  process.env.NETMIRROR_VERIFY_DOMAIN ||
  "https://net22.cc";
const NET_HOME_PATH =
  process.env.NETMIRROR_HOME_PATH ||
  "/home";

const port = process.env.PORT || 3000;



const crypto = require("crypto");
let netmirrorCookie = "";
let netmirrorCookieTime = 0;

function buildCookieHeader(setCookie = "") {
  return setCookie
    .split(/,(?=\s*[^;,]+=)/)
    .map(cookie => cookie.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function parseJsonStep(text, step, response) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const preview =
      String(text || "")
        .replace(/\s+/g, " ")
        .slice(0, 500);

    throw new Error(
      `${step} returned non-JSON` +
      ` status=${response?.status || "unknown"}` +
      ` content-type=${response?.headers?.get?.("content-type") || "unknown"}` +
      ` preview=${preview}`
    );
  }
}

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

async function getNetmirrorCookie() {

  if (
    netmirrorCookie &&
    Date.now() - netmirrorCookieTime < 1000 * 60 * 20
  ) {
    return netmirrorCookie;
  }

  console.log("INITIALIZING NETMIRROR SESSION");

  const res = await fetch(`${NET_MAIN}${NET_HOME_PATH}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml",
      "Referer": `${NET_MAIN}/`,
    }
  });

  if (!res.ok) {
    throw new Error(
      `NetMirror home failed: ${res.status}`
    );
  }

  const setCookie =
    res.headers.get("set-cookie") || "";

  const cookieHeader =
    buildCookieHeader(setCookie);

  if (!cookieHeader) {
    throw new Error("NetMirror session cookie not found");
  }

  netmirrorCookie = cookieHeader;
  netmirrorCookieTime = Date.now();

  return cookieHeader;
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

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`
    );

    const media = await tmdbRes.json();

    const title =
      type === "tv"
        ? media.name
        : media.title;

    const year = Number(
      (
        type === "tv"
          ? media.first_air_date
          : media.release_date
      )?.split("-")[0]
    );
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

console.log("========== CTG ENGINES ==========");
console.log("Server 1 :", r1.length);
console.log("Server 2 :", r2.length);
console.log("Server 3 :", r3.length);
console.log("Server 4 :", r4.length);

if (r4.length) {
    console.log("SERVER 4 FIRST RESULT:");
    console.log(r4[0]);
}

const results = [
    ...r1,
    ...r2,
    ...r3,
    ...r4
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

    // TMDB lookup
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

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.end(
      JSON.stringify(result)
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
	  // HLS.js expects subtitle URIs to point to subtitle playlists.
	  // Some providers put direct .vtt files here, which freezes playback.
	  .split("\n")
	  .filter(
	    line =>
	      !/^#EXT-X-MEDIA:/i.test(line) ||
	      !/TYPE=SUBTITLES/i.test(line) ||
	      !/\.vtt(?:["?]|$)/i.test(line)
	  )
	  .map(line =>
	    line.replace(/,?SUBTITLES="[^"]*"/gi, "")
	  )
	  .join("\n")
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

          url:
            `https://oracle.debflicks.com/api/hls-proxy?url=${encodeURIComponent(source.url)}`,

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
      const href = match[1];
      const file = decodeURIComponent(href);
      const fileUrl = new URL(href, folderUrl).href;

      streams.push({
        provider: "Dahmer",
        quality:
          file.match(/(2160p|1080p|720p)/i)?.[0] ||
          "Auto",
        filename: file,
        url: fileUrl
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
    ].map(m => ({
      filename: decodeURIComponent(m[1]),
      url: new URL(m[1], seasonUrl).href,
    }));

    let matchedFiles = files;

    if (episode) {
      const tag =
        `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;

      matchedFiles = files.filter(file =>
        file.filename.includes(tag)
      );
    }

    const streams = matchedFiles.map(file => ({
      provider: "Dahmer",
      quality:
        file.filename.match(/(2160p|1080p|720p)/i)?.[0] || "Auto",
      filename: file.filename,
      url: file.url
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

  try {
    const testDomain =
      query.domain || NET_MAIN;
    const testPath =
      query.path || NET_HOME_PATH;

    const r = await fetch(`${testDomain}${testPath}`, {
        headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36"
        }
    });

    return res.end(JSON.stringify({
        status: r.status,
        domain: testDomain,
        path: testPath,
        headers: Object.fromEntries(r.headers.entries())
    }, null, 2));
  } catch (e) {
    return res.end(
      JSON.stringify({
        success: false,
        domain: query.domain || NET_MAIN,
        path: query.path || NET_HOME_PATH,
        error: e.message,
        cause: e.cause?.message,
        code: e.cause?.code,
        hostname: e.cause?.hostname
      }, null, 2)
    );
  }
}


if (pathname === "/api/netmirror") {

  
  console.log("========== NETMIRROR ==========");
  try {
    const query = url.parse(req.url, true).query;

    const title = query.title;
const season = query.season || "1";
const episode = query.episode || "1";

let netmirrorSessionCookie;

try {
    netmirrorSessionCookie = await getNetmirrorCookie();
    console.log("COOKIE:", netmirrorSessionCookie);
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

    "Cookie": `${netmirrorSessionCookie}; hd=on; ott=nf`
  }
});

const body = await searchRes.text();

console.log("SEARCH BODY:");
console.log(body);


const search = parseJsonStep(
  body,
  "NetMirror search",
  searchRes
);

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

console.log("COOKIE TYPE:", typeof netmirrorSessionCookie);
console.log("COOKIE VALUE:", netmirrorSessionCookie);
console.log("POST COOKIE:");
console.log(`${netmirrorSessionCookie}; hd=on; ott=nf`);
const detailsRes = await fetch(detailsUrl, {
  headers: {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  "Referer": `${NET_MAIN}/home`,
  "Accept": "application/json, text/plain, */*",
  "Cookie": `${netmirrorSessionCookie}; hd=on; ott=nf`
}
});

console.log("POST STATUS:", detailsRes.status);
console.log("POST SET-COOKIE:", detailsRes.headers.get("set-cookie"));
const detailsBody = await detailsRes.text();

console.log("POST BODY:");
console.log(detailsBody);

const details = parseJsonStep(
  detailsBody,
  "NetMirror post",
  detailsRes
);
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

if (details.type === "m") {

  selectedEpisode = {
    id: first.id,
    t: first.t
  };

} else {

const seasonObj = details.season?.find(
  item => Number(item.s) === Number(season)
);

if (!seasonObj) {
  throw new Error("Season not found");
}

const epRes = await fetch(
  `${NET_MAIN}/mobile/episodes.php?s=${seasonObj.id}&series=${first.id}&page=1`,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0",
      "Referer": `${NET_MAIN}/home`,
      "Cookie": `${netmirrorSessionCookie}; hd=on; ott=nf`
    }
  }
);

const epText = await epRes.text();
console.log("EPISODES BODY:");
console.log(epText);

const epData = parseJsonStep(
  epText,
  "NetMirror episodes",
  epRes
);

selectedEpisode =
  epData.episodes?.find(
    e =>
      String(e.ep.replace("E","")) === String(episode)
  );

if (!selectedEpisode) {
  throw new Error("Episode not found");
}

}

// -------------------------------
// NETMIRROR PLAYBACK FLOW
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
      "Cookie": `${netmirrorSessionCookie}; hd=on; ott=nf`
    },
    body: new URLSearchParams({
      id: selectedEpisode.id
    })
  }
);

const playText = await playRes.text();

console.log("PLAY:");
console.log(playText);

const play = parseJsonStep(
  playText,
  "NetMirror play",
  playRes
);

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
  parseJsonStep(
    playlistText,
    "NetMirror playlist",
    playlistRes
  );

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
        domain: NET_MAIN,
        error: e.message,
        cause: e.cause?.message,
        code: e.cause?.code,
        hostname: e.cause?.hostname,
        stack: e.stack?.split("\n").slice(0, 3)
      }, null, 2)
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
