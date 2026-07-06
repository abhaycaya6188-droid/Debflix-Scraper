const fetch = global.fetch;

const VIDEASY_API = "https://api.wingsdatabase.com";

async function getSeed(tmdbId) {

    const res = await fetch(`${VIDEASY_API}/seed?mediaId=${tmdbId}`, {
        headers: {
            "Origin": "https://www.vidking.net",
            "Referer": "https://www.vidking.net/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9"
        }
    });

    if (!res.ok) {
        throw new Error(`Seed HTTP ${res.status}`);
    }

    const json = await res.json();

    if (!json.seed) {
        throw new Error("Seed missing");
    }

    return json.seed;

}

async function getVideasySources(query) {

    const tmdbId = query.id;

    if (!tmdbId) {
        return {
            success: false,
            error: "Missing TMDB id"
        };
    }

    const seed = await getSeed(tmdbId);

    const params = new URLSearchParams({
        title: query.title || "",
        mediaType: query.type || "movie",
        year: query.year || "",
        tmdbId,
        imdbId: query.imdbId || "",
        seasonId: query.season || "1",
        episodeId: query.episode || "1",
        enc: "2",
        seed,
        _t: Date.now().toString()
    });

    const url =
        `${VIDEASY_API}/cdn/sources-with-title?${params}`;

    const res = await fetch(url, {
        headers: {
            "Origin": "https://www.vidking.net",
            "Referer": "https://www.vidking.net/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9"
        }
    });

    const body = await res.text();

    return {
        success: true,
        seed,
        status: res.status,
        bodyLength: body.length,
        preview: body.substring(0, 300)
    };

}

module.exports = {
    getVideasySources
};