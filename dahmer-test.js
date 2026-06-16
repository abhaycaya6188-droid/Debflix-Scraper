const http = require("http");

http.createServer(async (req, res) => {
  try {
    const r = await fetch("https://a.111477.xyz/movies/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const text = await r.text();

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: r.status,
        length: text.length,
        preview: text.slice(0, 300),
      })
    );
  } catch (e) {
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(process.env.PORT || 3000);
