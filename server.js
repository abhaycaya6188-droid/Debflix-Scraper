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
    const tmdbKey = process.env.TMDB_API_KEY;

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/603?api_key=${tmdbKey}`
    );

    const movie = await tmdbRes.json();

    const year =
      movie.release_date.split("-")[0];

    const folderName =
      `${movie.title} (${year})`;

    const folderUrl =
      `https://a.111477.xyz/movies/${encodeURIComponent(folderName)}/`;

    const dirRes = await fetch(folderUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await dirRes.text();

    const matches = [
  ...html.matchAll(/href=['"]([^'"]+)['"]/gi)
].slice(0, 50);

return res.end(
  JSON.stringify({
    folderName,
    status: dirRes.status,
    matches
  })
);
  } catch (e) {
    return res.end(
      JSON.stringify({
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
