const http = require("http");
const url = require("url");

const vidlinkHandler = require("./api/index");

const port = process.env.PORT || 3000;

http
  .createServer(async (req, res) => {
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

    if (pathname === "/api/test-vixsrc") {
  try {
    const r = await fetch(
      "https://vixsrc.to/api/movie/603",
      {
        headers: {
          Referer: "https://vixsrc.to/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept:
            "application/json,text/plain,*/*",
        },
      }
    );

    const text = await r.text();

    res.setHeader("Content-Type", "application/json");

    return res.end(
      JSON.stringify({
        status: r.status,
        preview: text.slice(0, 500),
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
    return vidlinkHandler(req, res);
  })
  .listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
