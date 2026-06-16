export default async function handler(req, res) {
  try {
    const apiUrl =
      "https://vixsrc.to/api/movie/603"; // The Matrix

    const r = await fetch(apiUrl, {
      headers: {
        Referer: "https://vixsrc.to/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const text = await r.text();

    res.status(200).json({
      status: r.status,
      preview: text.slice(0, 500),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
