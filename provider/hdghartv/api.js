const { getJson } = require("./http");

const SITE_URL = "https://hdghartv.cc";
const API_BASE_URL = `${SITE_URL}/api`;

function buildUrl(pathname, query = {}) {
    const url = new URL(`${API_BASE_URL}${pathname}`);

    for (const [key, value] of Object.entries(query)) {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            continue;
        }

        url.searchParams.set(key, String(value));
    }

    return url.toString();
}

function unwrapListPayload(payload, fallbackPage = 1) {
    const root =
        payload?.data &&
        !Array.isArray(payload.data)
            ? payload.data
            : payload;

    const items =
        Array.isArray(root)
            ? root
            : Array.isArray(root?.data)
              ? root.data
              : Array.isArray(root?.items)
                ? root.items
                : Array.isArray(root?.results)
                  ? root.results
                  : [];

    return {
        items,
        total: Number(
            root?.total ??
            root?.totalItems ??
            root?.count ??
            items.length
        ),
        totalPages: Number(
            root?.totalPages ??
            root?.pages ??
            1
        ),
        page: Number(
            root?.page ??
            root?.currentPage ??
            fallbackPage
        ),
    };
}

async function fetchPublicMovies(query = {}) {
    const url = buildUrl("/movies/public", query);
    const { data } = await getJson(url);

    return unwrapListPayload(
        data,
        Number(query.page || 1)
    );
}

async function fetchPublicSeries(query = {}) {
    const url = buildUrl("/series/public", query);
    const { data } = await getJson(url);

    return unwrapListPayload(
        data,
        Number(query.page || 1)
    );
}

async function fetchMovieByInternalId(internalId) {
    if (!internalId) {
        throw new Error(
            "HDGharTV movie internal ID is required"
        );
    }

    const url = buildUrl(
        `/movies/public/${encodeURIComponent(internalId)}`
    );

    const { data } = await getJson(url);
    return data;
}

async function fetchSeriesByInternalId(internalId) {
    if (!internalId) {
        throw new Error(
            "HDGharTV series internal ID is required"
        );
    }

    const url = buildUrl(
        `/series/public/${encodeURIComponent(internalId)}`
    );

    const { data } = await getJson(url);
    return data;
}

async function fetchHomepageSections() {
    const url = buildUrl("/views/homepage/sections");
    const { data } = await getJson(url);

    const root =
        data?.data &&
        !Array.isArray(data.data)
            ? data.data
            : data;

    if (Array.isArray(root)) {
        return root;
    }

    if (Array.isArray(root?.sections)) {
        return root.sections;
    }

    return [];
}

async function fetchPublicSettings() {
    const url = buildUrl("/settings/public");
    const { data } = await getJson(url);

    return data?.data || data;
}

module.exports = {
    SITE_URL,
    API_BASE_URL,
    buildUrl,
    unwrapListPayload,
    fetchPublicMovies,
    fetchPublicSeries,
    fetchMovieByInternalId,
    fetchSeriesByInternalId,
    fetchHomepageSections,
    fetchPublicSettings,
};