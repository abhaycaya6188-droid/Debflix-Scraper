export default async function handler(req, res) {
  try {
    const r = await fetch("https://a.111477.xyz/movies/", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const text = await r.text();

    res.status(200).json({
      status: r.status,
      length: text.length,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
