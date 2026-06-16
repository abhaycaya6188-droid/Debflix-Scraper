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
    const r = await fetch(
      "https://a.111477.xyz/movies/",
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const html = await r.text();

    return res.end(
      JSON.stringify({
        preview: html.slice(0, 5000)
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
