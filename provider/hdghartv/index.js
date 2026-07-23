const { findContent } = require("./search");
const { resolveMovie } = require("./movie");
const { resolveSeriesEpisode } = require("./series");

function normalizeType(type) {
    const value = String(type || "").toLowerCase();

    if (
        value === "tv" ||
        value === "series" ||
        value === "show"
    ) {
        return "tv";
    }

    return "movie";
}

async function getHDGharTVStreams(options = {}) {
    const {
        tmdbId,
        id,
        type,
        title,
        year,
        season,
        episode,
    } = options;

    const normalizedType = normalizeType(type);
    const resolvedTmdbId = String(tmdbId || id || "");

    if (!resolvedTmdbId && !title) {
        return {
            success: false,
            provider: "HDGharTV",
            type: normalizedType,
            streams: [],
            qualities: [],
            default: null,
            error: "TMDB ID or title is required",
        };
    }

    if (
        normalizedType === "tv" &&
        (season === undefined || episode === undefined)
    ) {
        return {
            success: false,
            provider: "HDGharTV",
            type: "tv",
            tmdbId: resolvedTmdbId,
            streams: [],
            qualities: [],
            default: null,
            error: "Season and episode are required for TV",
        };
    }

    const content = await findContent({
        type: normalizedType,
        tmdbId: resolvedTmdbId,
        title,
        year,
    });

    if (!content) {
        return {
            success: false,
            provider: "HDGharTV",
            type: normalizedType,
            tmdbId: resolvedTmdbId,
            title: title || "",
            season:
                normalizedType === "tv"
                    ? Number(season)
                    : null,
            episode:
                normalizedType === "tv"
                    ? Number(episode)
                    : null,
            streams: [],
            qualities: [],
            default: null,
            error: "Content not found on HDGharTV",
        };
    }

    const internalId =
        content._id ||
        content.id ||
        content.internalId;

    if (!internalId) {
        return {
            success: false,
            provider: "HDGharTV",
            type: normalizedType,
            tmdbId: resolvedTmdbId,
            streams: [],
            qualities: [],
            default: null,
            error: "HDGharTV internal content ID was missing",
        };
    }

    if (normalizedType === "tv") {
        return resolveSeriesEpisode({
            internalId,
            tmdbId: resolvedTmdbId,
            title:
                content.title ||
                content.originalTitle ||
                title,
            season,
            episode,
        });
    }

    return resolveMovie({
        internalId,
        tmdbId: resolvedTmdbId,
        title:
            content.title ||
            content.originalTitle ||
            title,
        year,
    });
}

module.exports = {
    getHDGharTVStreams,
    normalizeType,
};