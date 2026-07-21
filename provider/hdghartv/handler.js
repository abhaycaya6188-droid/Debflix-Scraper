const {
    getHDGharTVStreams,
} = require("./index");

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.setHeader(
        "Cache-Control",
        "no-store, max-age=0"
    );

    res.end(JSON.stringify(payload));
}

function resolveRequestUrl(req, suppliedUrl) {
    if (
        suppliedUrl &&
        suppliedUrl.searchParams &&
        typeof suppliedUrl.searchParams.get === "function"
    ) {
        return suppliedUrl;
    }

    return new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
    );
}

async function handleHDGharTV(req, res, suppliedUrl) {
    try {
        const url = resolveRequestUrl(req, suppliedUrl);

        const id =
            url.searchParams.get("id") ||
            url.searchParams.get("tmdbId") ||
            "";

        const type =
            url.searchParams.get("type") ||
            "movie";

        const title =
            url.searchParams.get("title") ||
            "";

        const year =
            url.searchParams.get("year") ||
            "";

        const season =
            url.searchParams.get("season");

        const episode =
            url.searchParams.get("episode");

        if (!id && !title) {
            return sendJson(res, 400, {
                success: false,
                provider: "HDGharTV",
                streams: [],
                qualities: [],
                default: null,
                error: "Missing id or title",
            });
        }

        const result =
            await getHDGharTVStreams({
                id,
                tmdbId: id,
                type,
                title,
                year,
                season,
                episode,
            });

        return sendJson(
            res,
            result.success ? 200 : 404,
            result
        );
    } catch (error) {
        console.error(
            "[HDGharTV]",
            error instanceof Error
                ? error.stack || error.message
                : error
        );

        return sendJson(res, 500, {
            success: false,
            provider: "HDGharTV",
            streams: [],
            qualities: [],
            default: null,
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
}

module.exports = {
    handleHDGharTV,
    resolveRequestUrl,
};