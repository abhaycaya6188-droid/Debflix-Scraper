const VIDEASY_API = "https://api.wingsdatabase.com";

async function getSeed(tmdbId) {

    const response = await fetch(
        `${VIDEASY_API}/seed?mediaId=${tmdbId}`
    );

    const body = await response.text();

    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body
    };

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

    return {
        success: true,
        stage: "seed",
        seed
    };

}

module.exports = {
    getVideasySources
};