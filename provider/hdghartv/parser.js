const PROVIDER = "HDGharTV";
const SITE_URL = "https://hdghartv.cc";

function normalizeQuality(value) {
    const text = String(value || "").toLowerCase();

    if (text.includes("2160") || text.includes("4k")) {
        return "2160p";
    }

    if (text.includes("1080")) {
        return "1080p";
    }

    if (text.includes("720")) {
        return "720p";
    }

    if (text.includes("480")) {
        return "480p";
    }

    if (text.includes("360")) {
        return "360p";
    }

    return "Unknown";
}

function qualityRank(quality) {
    const ranks = {
        "2160p": 5,
        "1080p": 4,
        "720p": 3,
        "480p": 2,
        "360p": 1,
        Unknown: 0,
    };

    return ranks[quality] || 0;
}

function normalizeLanguage(value) {
    const language = String(value || "").trim();

    if (!language) {
        return "Multi";
    }

    const lower = language.toLowerCase();

    if (
        lower.includes("multi") ||
        lower.includes("dual")
    ) {
        return "Multi";
    }

    if (
        lower.includes("hindi") ||
        lower === "hin"
    ) {
        return "Hindi";
    }

    if (
        lower.includes("english") ||
        lower === "eng"
    ) {
        return "English";
    }

    return language;
}

function parseHeaders(value) {
    if (!value) {
        return {};
    }

    if (typeof value === "object" && !Array.isArray(value)) {
        return value;
    }

    const text = String(value).trim();

    if (!text) {
        return {};
    }

    try {
        const parsed = JSON.parse(text);

        if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
        ) {
            return parsed;
        }
    } catch {
        // Continue with line-based parsing.
    }

    const headers = {};

    for (const line of text.split(/\r?\n/)) {
        const separator = line.indexOf(":");

        if (separator <= 0) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const headerValue = line.slice(separator + 1).trim();

        if (key && headerValue) {
            headers[key] = headerValue;
        }
    }

    return headers;
}

function detectStreamType(link) {
    const explicitType = String(link?.type || "").toLowerCase();
    const url = String(link?.url || "").toLowerCase();

    if (
        explicitType === "hls" ||
        url.includes(".m3u8")
    ) {
        return "M3U8";
    }

    if (
        url.includes(".mp4") ||
        url.includes(".mkv")
    ) {
        return "DirectFile";
    }

    if (link?.embed) {
        return "Embed";
    }

    return "Unknown";
}

function buildProxyHeaders(link) {
    const supplied = parseHeaders(link?.headers);

    return {
        ...supplied,
        Origin:
            supplied.Origin ||
            supplied.origin ||
            SITE_URL,
        Referer:
            supplied.Referer ||
            supplied.referer ||
            `${SITE_URL}/`,
        "User-Agent":
            supplied["User-Agent"] ||
            supplied["user-agent"] ||
            link?.userAgent ||
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/149.0.0.0 Safari/537.36",
    };
}

function isUsableStreamingLink(link) {
    if (!link || typeof link !== "object") {
        return false;
    }

    if (!link.url) {
        return false;
    }

    if (link.isActive === false) {
        return false;
    }

    if (link.drm === true) {
        return false;
    }

    const streamType = detectStreamType(link);

    return (
        streamType === "M3U8" ||
        streamType === "DirectFile" ||
        streamType === "Embed"
    );
}

function parseStreamingLink(link, context = {}) {
    if (!isUsableStreamingLink(link)) {
        return null;
    }

    const quality = normalizeQuality(link.quality);
    const streamType = detectStreamType(link);
    const proxyHeaders = buildProxyHeaders(link);

    return {
        id:
            link._id ||
            `${context.internalId || "unknown"}-${quality}-${context.season || 0}-${context.episode || 0}`,

        provider: PROVIDER,
        source: PROVIDER,
        name: `${PROVIDER} ${quality}`,

        title: context.title || "",
        tmdbId: context.tmdbId
            ? String(context.tmdbId)
            : "",

        type: context.type || "movie",
        season:
            context.season === undefined
                ? null
                : Number(context.season),
        episode:
            context.episode === undefined
                ? null
                : Number(context.episode),

        quality,
        language: normalizeLanguage(link.language),

        codec: "HLS",
        audio: "Unknown",

        url: link.url,
        streamUrl: link.url,

        streamType,
        browserFriendly: streamType === "M3U8",

        proxyHeaders,

        referer: proxyHeaders.Referer,
        origin: proxyHeaders.Origin,

        drm: false,
        embed: Boolean(link.embed),

        downloadDisabled:
            link.downloadDisabled !== false,

        expiresAt: getExpiryFromUrl(link.url),

        sourceId: link._id || "",
        internalId: context.internalId || "",
    };
}

function getExpiryFromUrl(url) {
    try {
        const parsed = new URL(url);
        const expires = parsed.searchParams.get("expires");

        if (!expires) {
            return null;
        }

        const timestamp = Number(expires);

        if (!Number.isFinite(timestamp)) {
            return null;
        }

        return timestamp * 1000;
    } catch {
        return null;
    }
}

function parseStreamingLinks(links, context = {}) {
    const parsed = [];
    const seen = new Set();

    for (const link of links || []) {
        const stream = parseStreamingLink(link, context);

        if (!stream) {
            continue;
        }

        const key = `${stream.url}|${stream.quality}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        parsed.push(stream);
    }

    parsed.sort(
        (a, b) =>
            qualityRank(b.quality) -
            qualityRank(a.quality)
    );

    return parsed;
}

function selectDefaultStream(streams) {
    if (!Array.isArray(streams) || streams.length === 0) {
        return null;
    }

    return (
        streams.find((stream) => stream.quality === "1080p") ||
        streams.find((stream) => stream.quality === "720p") ||
        streams[0]
    );
}

module.exports = {
    PROVIDER,
    SITE_URL,
    normalizeQuality,
    normalizeLanguage,
    qualityRank,
    parseHeaders,
    detectStreamType,
    buildProxyHeaders,
    isUsableStreamingLink,
    parseStreamingLink,
    parseStreamingLinks,
    selectDefaultStream,
    getExpiryFromUrl,
};