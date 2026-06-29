const TMDB_API_KEY = "7bf6b8cf4d8a661e8a90ae825995471d";
console.log("RAILWAY FORCE REBUILD");
const http = require("http");
const url = require("url");
const { execSync } = require("child_process");

const vidlinkHandler = require("./api/index");

const port = process.env.PORT || 3000;

http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "*");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

if (req.method === "OPTIONS") {
  res.statusCode = 200;
  return res.end();
}
    const pathname = url.parse(req.url).pathname;

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

    const apiJson = await apiRes.json();

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
  `https://macro-immigration-filters-influence.trycloudflare.com/api/test-playlist?url=${encodeURIComponent(stream)}`;

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

if (pathname === "/api/netmirror") {
  console.log("========== NETMIRROR ==========");
  try {
    const query = url.parse(req.url, true).query;

    const title = query.title;
const season = query.season || "1";
const episode = query.episode || "1";

    const searchUrl =
  `https://net11.cc/search.php?s=${encodeURIComponent(title)}&t=${Math.floor(Date.now() / 1000)}`;

console.log("SEARCH URL:", searchUrl);

const searchRes = await fetch(searchUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://net11.cc/home"
  }
});

const body = await searchRes.text();

console.log("SEARCH BODY:");
console.log(body);

const search = JSON.parse(body);


    const first =
      search.searchResult?.[0];

    if (!first) {
      return res.end(
        JSON.stringify({
          success: false
        })
      );
    }

    const detailsRes = await fetch(
      `https://tv.imgcdn.kim/newtv/post.php?id=${first.id}`
    );

    const details =
      await detailsRes.json();

    const seasonObj =
      details.season?.find(s =>
        s.s.includes(`Season ${season}`)
      );

    if (!seasonObj) {
  return res.end(
    JSON.stringify({
      success: false,
      error: "Season not found"
    })
  );
}

const epRes = await fetch(
  `https://net52.cc/mobile/episodes.php?s=${seasonObj.id}&series=${first.id}&page=1`
);

const epData =
  await epRes.json();

const selectedEpisode =
  epData.episodes?.find(
    e =>
      String(
        e.ep.replace("E", "")
      ) === String(episode)
  );

if (!selectedEpisode) {
  return res.end(
    JSON.stringify({
      success: false,
      error: "Episode not found"
    })
  );
}

const playerRes = await fetch(
  `https://tv.imgcdn.kim/newtv/player.php?id=${selectedEpisode.id}`,
  {
    headers: {
      Ott: "nf",
      "X-Requested-With":
        "NetmirrorNewTV v1.0",
    },
  }
);

const player =
  await playerRes.json();

return res.end(
  JSON.stringify({
    success: true,
    episode: selectedEpisode.t,
    video_link: player.video_link,
    referer: player.referer,
    ott: player.ott
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
  "https://macro-immigration-filters-influence.trycloudflare.com";

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
    `${tunnel}/api/test-playlist?url=${encodeURIComponent(match)}`
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

return vidlinkHandler(req, res);
  })
  .listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
