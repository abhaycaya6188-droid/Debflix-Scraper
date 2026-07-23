const {
    fetchSeriesByInternalId,
} = require("./api");

const {
    parseStreamingLinks,
    selectDefaultStream,
} = require("./parser");

function unwrapSeriesPayload(payload) {
    if (!payload) {
        return null;
    }

    if (payload.data && typeof payload.data === "object") {
        return payload.data;
    }

    if (payload.series && typeof payload.series === "object") {
        return payload.series;
    }

    return payload;
}

function findSeason(series, seasonNumber) {
    const wantedSeason = Number(seasonNumber);

    return (series?.seasons || []).find(
        (season) =>
            Number(
                season?.seasonNumber ??
                season?.number ??
                season?.season
            ) === wantedSeason
    );
}

function findEpisode(season, episodeNumber) {
    const wantedEpisode = Number(episodeNumber);

    return (season?.episodes || []).find(
        (episode) =>
            Number(
                episode?.episodeNumber ??
                episode?.number ??
                episode?.episode
            ) === wantedEpisode
    );
}

function collectEpisodeLinks(episode) {
    const candidates = [
        episode?.streamingLinks,
        episode?.streams,
        episode?.links,
        episode?.videos,
        episode?.sources,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

async function resolveSeriesEpisode({
    internalId,
    tmdbId,
    title,
    season,
    episode,
}) {
    if (!internalId) {
        throw new Error(
            "HDGharTV series internal ID is required"
        );
    }

    const seasonNumber = Number(season);
    const episodeNumber = Number(episode);

    if (
        !Number.isInteger(seasonNumber) ||
        seasonNumber < 0
    ) {
        throw new Error(
            "HDGharTV valid season number is required"
        );
    }

    if (
        !Number.isInteger(episodeNumber) ||
        episodeNumber < 1
    ) {
        throw new Error(
            "HDGharTV valid episode number is required"
        );
    }

    const payload =
        await fetchSeriesByInternalId(internalId);

    const series = unwrapSeriesPayload(payload);

    if (!series) {
        throw new Error(
            "HDGharTV series detail response was empty"
        );
    }

    const selectedSeason = findSeason(
        series,
        seasonNumber
    );

    if (!selectedSeason) {
        return {
            success: false,
            provider: "HDGharTV",
            type: "tv",
            internalId,
            tmdbId: String(
                series.tmdbId ||
                    series.tmdb_id ||
                    tmdbId ||
                    ""
            ),
            title:
                series.title ||
                series.originalTitle ||
                title ||
                "",
            season: seasonNumber,
            episode: episodeNumber,
            streams: [],
            qualities: [],
            default: null,
            error: `Season ${seasonNumber} not found`,
        };
    }

    const selectedEpisode = findEpisode(
        selectedSeason,
        episodeNumber
    );

    if (!selectedEpisode) {
        return {
            success: false,
            provider: "HDGharTV",
            type: "tv",
            internalId,
            tmdbId: String(
                series.tmdbId ||
                    series.tmdb_id ||
                    tmdbId ||
                    ""
            ),
            title:
                series.title ||
                series.originalTitle ||
                title ||
                "",
            season: seasonNumber,
            episode: episodeNumber,
            streams: [],
            qualities: [],
            default: null,
            error:
                `Episode ${episodeNumber} not found ` +
                `in season ${seasonNumber}`,
        };
    }

    const links =
        collectEpisodeLinks(selectedEpisode);

    const streams = parseStreamingLinks(links, {
        type: "tv",
        internalId:
            series._id ||
            series.id ||
            internalId,
        tmdbId:
            series.tmdbId ||
            series.tmdb_id ||
            tmdbId,
        title:
            series.title ||
            series.originalTitle ||
            title,
        season: seasonNumber,
        episode: episodeNumber,
    });

    return {
        success: streams.length > 0,
        provider: "HDGharTV",
        type: "tv",

        internalId:
            series._id ||
            series.id ||
            internalId,

        tmdbId: String(
            series.tmdbId ||
                series.tmdb_id ||
                tmdbId ||
                ""
        ),

        title:
            series.title ||
            series.originalTitle ||
            title ||
            "",

        originalTitle:
            series.originalTitle ||
            series.title ||
            title ||
            "",

        season: seasonNumber,
        episode: episodeNumber,

        seasonTitle:
            selectedSeason.name ||
            `Season ${seasonNumber}`,

        episodeTitle:
            selectedEpisode.name ||
            `Episode ${episodeNumber}`,

        episodeTmdbId:
            selectedEpisode.tmdbId ||
            selectedEpisode.tmdb_id ||
            null,

        poster:
            selectedSeason.posterPath ||
            series.posterPath ||
            "",

        still:
            selectedEpisode.stillPath ||
            "",

        default: selectDefaultStream(streams),
        streams,
        qualities: streams,

        error:
            streams.length > 0
                ? undefined
                : "No usable HDGharTV episode streams found",
    };
}

module.exports = {
    resolveSeriesEpisode,
    unwrapSeriesPayload,
    findSeason,
    findEpisode,
    collectEpisodeLinks,
};