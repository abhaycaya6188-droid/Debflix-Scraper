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
    return encodeURIComponent(
        encodeURIComponent(title || "")
    );
}

async function getSeed(tmdbId) {
    const url =
        `${VIDEASY_API}/seed?mediaId=` +
        encodeURIComponent(tmdbId);

    const res = await fetch(url, {
        headers: VIDEASY_HEADERS
    });

    const body = await res.text();

    if (!res.ok) {
        throw new Error(
            `Videasy seed HTTP ${res.status}: ` +
            body.slice(0, 300)
        );
    }

    let json;

    try {
        json = JSON.parse(body);
    } catch {
        throw new Error(
            "Videasy seed response was not JSON"
        );
    }

    if (!json.seed) {
        throw new Error("Videasy seed missing");
    }

    return String(json.seed);
}

async function decryptVideasyPayload(
    encryptedText,
    tmdbId,
    seed
) {
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
            `Videasy decrypt HTTP ${res.status}: ` +
            body.slice(0, 300)
        );
    }

    let json;

    try {
        json = JSON.parse(body);
    } catch {
        throw new Error(
            "Videasy decrypt response was not JSON"
        );
    }

    if (json.status !== 200 || !json.result) {
        throw new Error(
            `Videasy decrypt failed: ` +
            JSON.stringify(json).slice(0, 300)
        );
    }

    return json.result;
}

async function getVideasySources(query) {
    try {
        const tmdbId = String(
            query.id ||
            query.tmdbId ||
            ""
        );

        if (!tmdbId) {
            return {
                success: false,
                provider: "Videasy",
                error: "Missing TMDB id",
                streams: []
            };
        }

        const type =
            query.type === "tv"
                ? "tv"
                : "movie";

        const seed = await getSeed(tmdbId);

        /*
         * CDN has been confirmed working for movies.
         * Keep this as CDN until we separately test TV.
         */
        const server = "cdn";

        const params = new URLSearchParams({
            mediaType: type,
            year: String(query.year || ""),
            tmdbId,
            imdbId: String(query.imdbId || ""),
            seasonId: String(query.season || "1"),
            episodeId: String(query.episode || "1"),
            enc: "2",
            seed
        });

        const encodedTitle =
            doubleEncodeTitle(query.title || "");

        const url =
            `${VIDEASY_API}/${server}/sources-with-title` +
            `?title=${encodedTitle}&${params.toString()}`;

        const sourceRes = await fetch(url, {
            headers: VIDEASY_HEADERS
        });

        const encryptedBody =
            await sourceRes.text();

        if (!sourceRes.ok) {
            throw new Error(
                `Videasy source HTTP ${sourceRes.status}: ` +
                encryptedBody.slice(0, 300)
            );
        }

        if (!encryptedBody.trim()) {
            return {
                success: false,
                provider: "Videasy",
                error: "Videasy returned an empty response",
                streams: []
            };
        }

        const decrypted =
            await decryptVideasyPayload(
                encryptedBody,
                tmdbId,
                seed
            );

        const rawSources =
            Array.isArray(decrypted.sources)
                ? decrypted.sources
                : [];

        const subtitles =
            Array.isArray(decrypted.subtitles)
                ? decrypted.subtitles
                    .filter(
                        subtitle =>
                            subtitle &&
                            subtitle.url
                    )
                    .map(subtitle => ({
                        label:
                            subtitle.language ||
                            subtitle.lang ||
                            "Unknown",
                        language:
                            subtitle.language ||
                            subtitle.lang ||
                            "Unknown",
                        lang:
                            subtitle.lang ||
                            subtitle.language ||
                            "Unknown",
                        url: subtitle.url
                    }))
                : [];

        const streams = rawSources
            .filter(
                source =>
                    source &&
                    typeof source.url === "string" &&
                    source.url.startsWith("http")
            )
            .map((source, index) => ({
                id: `videasy-${index + 1}`,
                provider: "Videasy",
                name: "Videasy",
                quality:
                    source.quality || "Auto",
                url: source.url,
                stream:
                    source.url,
                type: "hls",
                streamType: "M3U8",
                codec: "HLS",
                language: "Multi",
                proxyHeaders: VIDEASY_HEADERS,
                subtitles
            }));

        return {
            success: streams.length > 0,
            provider: "Videasy",
            server,
            tmdbId,
            streams,
            sources: streams,
            subtitles,
            error:
                streams.length === 0
                    ? "No Videasy streams found"
                    : undefined
        };

    } catch (error) {
        return {
            success: false,
            provider: "Videasy",
            streams: [],
            sources: [],
            error:
                error?.message ||
                "Unknown Videasy error"
        };
    }
}

module.exports = {
    getVideasySources
};
