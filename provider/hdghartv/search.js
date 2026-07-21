const {
    fetchPublicMovies,
    fetchPublicSeries,
    fetchHomepageSections,
} = require("./api");

const {
    getTmdbId,
    selectBestCandidate,
    uniqueByInternalId,
} = require("./utils");

const SEARCH_LIMIT = 100;
const MAX_PAGES = 20;

function isExactTmdbMatch(item, tmdbId) {
    return (
        tmdbId &&
        getTmdbId(item) === String(tmdbId)
    );
}

async function searchCatalogPages({
    type,
    tmdbId,
    title,
    year,
}) {
    const fetchCatalog =
        type === "tv"
            ? fetchPublicSeries
            : fetchPublicMovies;

    const collected = [];

    /*
     * The public API accepts ordinary listing parameters.
     * Try direct search-related parameters first because different
     * backend versions may use search, query, title or tmdbId.
     */
    const attempts = [
        { tmdbId, page: 1, limit: SEARCH_LIMIT },
        { search: title, page: 1, limit: SEARCH_LIMIT },
        { query: title, page: 1, limit: SEARCH_LIMIT },
        { title, page: 1, limit: SEARCH_LIMIT },
    ];

    for (const query of attempts) {
        const cleanedQuery = Object.fromEntries(
            Object.entries(query).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    value !== ""
            )
        );

        try {
            const result = await fetchCatalog(cleanedQuery);
            collected.push(...result.items);

            const exact = result.items.find((item) =>
                isExactTmdbMatch(item, tmdbId)
            );

            if (exact) {
                return exact;
            }

            const best = selectBestCandidate(result.items, {
                tmdbId,
                title,
                year,
            });

            if (best.score >= 1000) {
                return best.item;
            }
        } catch {
            // Try the next supported query format.
        }
    }

    /*
     * Reliable fallback: paginate through the public catalog.
     * This avoids depending on undocumented search parameter names.
     */
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await fetchCatalog({
            page,
            limit: SEARCH_LIMIT,
        });

        collected.push(...result.items);

        const exact = result.items.find((item) =>
            isExactTmdbMatch(item, tmdbId)
        );

        if (exact) {
            return exact;
        }

        if (page >= result.totalPages) {
            break;
        }
    }

    const unique = uniqueByInternalId(collected);
    const best = selectBestCandidate(unique, {
        tmdbId,
        title,
        year,
    });

    return best.score >= 500 ? best.item : null;
}

async function searchHomepageFallback({
    type,
    tmdbId,
    title,
    year,
}) {
    try {
        const sections = await fetchHomepageSections();
        const items = [];

        for (const section of sections) {
            for (const item of section?.items || []) {
                const itemType = String(
                    item?.type ||
                    item?.contentType ||
                    ""
                ).toLowerCase();

                const wantedType =
                    type === "tv" ? "series" : "movie";

                if (itemType && itemType !== wantedType) {
                    continue;
                }

                items.push(item);
            }
        }

        const exact = items.find((item) =>
            isExactTmdbMatch(item, tmdbId)
        );

        if (exact) {
            return exact;
        }

        const best = selectBestCandidate(items, {
            tmdbId,
            title,
            year,
        });

        return best.score >= 500 ? best.item : null;
    } catch {
        return null;
    }
}

async function findContent({
    type,
    tmdbId,
    title,
    year,
}) {
    const normalizedType =
        type === "tv" || type === "series"
            ? "tv"
            : "movie";

    const catalogResult = await searchCatalogPages({
        type: normalizedType,
        tmdbId,
        title,
        year,
    });

    if (catalogResult) {
        return catalogResult;
    }

    return searchHomepageFallback({
        type: normalizedType,
        tmdbId,
        title,
        year,
    });
}

module.exports = {
    findContent,
    searchCatalogPages,
    searchHomepageFallback,
};