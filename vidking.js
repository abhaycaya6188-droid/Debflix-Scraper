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

    const res = await fetch(
        `${API}/seed?mediaId=${tmdbId}`
    );

    if (!res.ok) {
        throw new Error(
            `Seed HTTP ${res.status}`
        );
    }

    const json = await res.json();

    if (!json.seed) {
        throw new Error(
            "Seed missing"
        );
    }

    return json.seed;
}

module.exports = {
    getSeed,
    PROVIDERS,
    API
};