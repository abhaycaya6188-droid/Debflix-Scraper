const fetch = global.fetch;

const API = "https://api.wingsdatabase.com";

const PROVIDERS = [
    "cdn",
    "tejo",
    "neon2",
    "downloader2",
    "1movies"
];

async function getSeed(tmdbId) {
    const res = await fetch(`${API}/seed?mediaId=${tmdbId}`);

    if (!res.ok) {
        throw new Error(`Seed HTTP ${res.status}`);
    }

    const json = await res.json();

    if (!json.seed) {
        throw new Error("Seed missing");
    }

    return json.seed;
}

async function fetchEncrypted(provider, params) {

    const seed = await getSeed(params.tmdbId);

    const query = new URLSearchParams({
        title: params.title || "",
        mediaType: params.mediaType || "movie",
        year: params.year || "",
        tmdbId: String(params.tmdbId),
        imdbId: params.imdbId || "",
        seasonId: String(params.seasonId || 1),
        episodeId: String(params.episodeId || 1),
        enc: "2",
        seed,
        _t: Date.now().toString()
    });

    const url =
        `${API}/${provider}/sources-with-title?${query}`;

    console.log("VIDKING URL:");
    console.log(url);

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            `${provider} HTTP ${res.status}`
        );
    }

    const text = await res.text();

    return {
        seed,
        encrypted: text
    };
}

module.exports = {
    API,
    PROVIDERS,
    getSeed,
    fetchEncrypted
};