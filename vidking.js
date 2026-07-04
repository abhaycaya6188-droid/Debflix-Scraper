const fetch = global.fetch;

const API = "https://api.wingsdatabase.com";

// ===== VidKing decrypt constants =====

const jl = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580
];

const Tf = [
    1732584193,
    4023233417,
    2562383102,
    271733878
];

const Js = 61;
const _f = 8;
const ms = 2654435769;

const Ys = [
    109,
    118,
    109,
    49
];

function Sf(v) {
    return (v * (v + 1) & 1) === 0;
}

function bf(v) {
    return (v * (v + 1) & 1) === 1;
}

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