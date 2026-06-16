export default async function handler(req, res) {
  try {
    const r = await fetch("https://a.111477.xyz/movies/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.5",
        "Referer":
          "https://google.com/",
        "Cache-Control":
          "no-cache",
      },
    });

    const text = await r.text();

    res.status(200).json({
      status: r.status,
      length: text.length,
      preview: text.slice(0, 300),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
