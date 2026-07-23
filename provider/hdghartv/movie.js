const {
    fetchMovieByInternalId,
} = require("./api");

const {
    parseStreamingLinks,
    selectDefaultStream,
} = require("./parser");

function unwrapMoviePayload(payload) {
    if (!payload) {
        return null;
    }

    if (payload.data && typeof payload.data === "object") {
        return payload.data;
    }

    if (payload.movie && typeof payload.movie === "object") {
        return payload.movie;
    }

    return payload;
}

function collectMovieStreamingLinks(movie) {
    const candidates = [
        movie?.streamingLinks,
        movie?.streams,
        movie?.links,
        movie?.videos,
        movie?.sources,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

async function resolveMovie({
    internalId,
    tmdbId,
    title,
    year,
}) {
    if (!internalId) {
        throw new Error(
            "HDGharTV movie internal ID is required"
        );
    }

    const payload =
        await fetchMovieByInternalId(internalId);

    const movie = unwrapMoviePayload(payload);

    if (!movie) {
        throw new Error(
            "HDGharTV movie detail response was empty"
        );
    }

    const links = collectMovieStreamingLinks(movie);

    const streams = parseStreamingLinks(links, {
        type: "movie",
        internalId:
            movie._id ||
            movie.id ||
            internalId,
        tmdbId:
            movie.tmdbId ||
            movie.tmdb_id ||
            tmdbId,
        title:
            movie.title ||
            movie.originalTitle ||
            title,
    });

    return {
        success: streams.length > 0,
        provider: "HDGharTV",
        type: "movie",

        internalId:
            movie._id ||
            movie.id ||
            internalId,

        tmdbId: String(
            movie.tmdbId ||
                movie.tmdb_id ||
                tmdbId ||
                ""
        ),

        title:
            movie.title ||
            movie.originalTitle ||
            title ||
            "",

        originalTitle:
            movie.originalTitle ||
            movie.title ||
            title ||
            "",

        year:
            year ||
            extractYear(
                movie.releaseDate ||
                movie.year
            ),

        poster:
            movie.posterPath ||
            movie.poster ||
            "",

        backdrop:
            movie.backdropPath ||
            movie.backdrop ||
            "",

        default: selectDefaultStream(streams),
        streams,
        qualities: streams,

        error:
            streams.length > 0
                ? undefined
                : "No usable HDGharTV movie streams found",
    };
}

function extractYear(value) {
    const match = String(value || "").match(
        /\b(19|20)\d{2}\b/
    );

    return match ? Number(match[0]) : null;
}

module.exports = {
    resolveMovie,
    unwrapMoviePayload,
    collectMovieStreamingLinks,
};