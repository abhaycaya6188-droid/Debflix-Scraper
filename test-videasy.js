const fetch = global.fetch;

const VIDEASY_API = "https://api.wingsdatabase.com";
const DECRYPT_API = "https://enc-dec.app/api/dec-videasy";

const VIDEASY_HEADERS = {
    Accept: "*/*",
    Origin: "https://player.videasy.to",
    Referer: "https://player.videasy.to/",
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/149.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
};

function doubleEncodeTitle(title) {
    return encodeURIComponent(encodeURIComponent(title || ""));
}

async function getSeed(tmdbId) {
    const url =
        `${VIDEASY_API}/seed?mediaId=${encodeURIComponent(tmdbId)}`;

    const res = await fetch(url, {
        headers: VIDEASY_HEADERS
    });

    const body = await res.text();

    if (!res.ok) {
        throw new Error(
            `Videasy seed HTTP ${res.status}: ${body.slice(0, 300)}`
        );
    }

    let json;

    try {
        json = JSON.parse(body);
    } catch {
        throw new Error(
            `Videasy seed was not JSON: ${body.slice(0, 300)}`
        );
    }

    if (!json.seed) {
        throw new Error(
            `Videasy seed missing: ${JSON.stringify(json).slice(0, 300)}`
        );
    }

    return String(json.seed);
}

async function decryptVideasyPayload(encryptedText, tmdbId, seed) {
    const res = await fetch(DECRYPT_API, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: encryptedText,
            id: String(tmdbId),
            seed: String(seed)
        })
    });

    const body = await res.text();

    if (!res.ok) {
        throw new Error(
            `Videasy decrypt HTTP ${res.status}: ${body.slice(0, 500)}`
        );
    }

    let json;

    try {
        json = JSON.parse(body);
    } catch {
        throw new Error(
            `Videasy decrypt response was not JSON: ${body.slice(0, 500)}`
        );
    }

    if (json.status !== 200) {
        throw new Error(
            `Videasy decrypt failed: ${JSON.stringify(json).slice(0, 500)}`
        );
    }

    return json.result;
}

async function getVideasySources(query) {
    const tmdbId = String(query.id || query.tmdbId || "");

    if (!tmdbId) {
        return {
            success: false,
            error: "Missing TMDB id"
        };
    }

    const mediaType =
        query.type === "tv" ? "tv" : "movie";

    const seed = await getSeed(tmdbId);

    /*
     * Begin with CDN for movies.
     * CDN/Yoru may not work reliably for TV.
     */
    const server =
        mediaType === "movie"
            ? "cdn"
            : "jett";

    const params = new URLSearchParams();

    /*
     * URLSearchParams would encode '%' again, so giving it an already
     * double-encoded title may result in triple encoding.
     * Therefore, title is added manually below.
     */
    params.set("mediaType", mediaType);
    params.set("year", String(query.year || ""));
    params.set("tmdbId", tmdbId);
    params.set("imdbId", String(query.imdbId || ""));
    params.set("seasonId", String(query.season || "1"));
    params.set("episodeId", String(query.episode || "1"));
    params.set("enc", "2");
    params.set("seed", seed);

    const encodedTitle = doubleEncodeTitle(query.title || "");

    const url =
        `${VIDEASY_API}/${server}/sources-with-title` +
        `?title=${encodedTitle}&${params.toString()}`;

    const sourceRes = await fetch(url, {
        headers: VIDEASY_HEADERS
    });

    const encryptedBody = await sourceRes.text();

    if (!sourceRes.ok) {
        throw new Error(
            `Videasy source HTTP ${sourceRes.status}: ` +
            encryptedBody.slice(0, 500)
        );
    }

    if (!encryptedBody.trim()) {
        return {
            success: false,
            provider: "Videasy",
            error: "Videasy returned an empty encrypted response",
            server,
            status: sourceRes.status
        };
    }

    const decrypted = await decryptVideasyPayload(
        encryptedBody,
        tmdbId,
        seed
    );

    return {
        success: true,
        provider: "Videasy",
        server,
        tmdbId,
        seed,
        decrypted
    };
}

module.exports = {
    getVideasySources
};

(async () => {
    try {
        const result = await getVideasySources({
            id: "157336",
            tmdbId: "157336",
            imdbId: "tt0816692",
            title: "Interstellar",
            year: "2014",
            type: "movie"
        });

        console.dir(result, {
            depth: null
        });

    } catch (err) {
        console.error(err);
    }
})();