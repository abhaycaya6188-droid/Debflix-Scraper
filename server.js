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
const NET_VERIFY = "https://net11.cc";
const NET_MAIN = "https://net11.cc";

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
  `https://oracle.debflicks.com/api/hls-proxy?url=${encodeURIComponent(stream)}`;

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

    const r = await fetch("https://net11.cc/home", {
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