const MOVIEBOX_API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const MOVIEBOX_CLIENT_INFO = "{\"timezone\":\"Africa/Nairobi\"}";
const MOVIEBOX_DOWNLOAD_REFERER = "https://videodownloader.site/";
const MOVIEBOX_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

async function createMovieBoxGuestSession() {
    const handshakeResponse = await fetch(`${MOVIEBOX_API}/subject/search-suggest`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Client-Info": MOVIEBOX_CLIENT_INFO,
            "User-Agent": MOVIEBOX_USER_AGENT,
        },
        body: JSON.stringify({ keyword: "avatar", perPage: 0 }),
        signal: AbortSignal.timeout(15_000),
    });

    if (!handshakeResponse.ok) {
        throw new Error(`MovieBox guest HTTP ${handshakeResponse.status}`);
    }

    const xUserHeader = handshakeResponse.headers.get("x-user");
    let guestToken = "";
    if (xUserHeader) {
        try {
            guestToken = JSON.parse(xUserHeader)?.token || "";
        } catch {}
    }
    if (!guestToken) throw new Error("MovieBox guest token missing");

    const cookiesList = [];
    const collectCookies = response => {
        const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
        const values = getSetCookie ? getSetCookie() : [response.headers.get("set-cookie") || ""];
        for (const cookie of values) {
            const pair = String(cookie || "").split(";", 1)[0].trim();
            if (pair.includes("=")) cookiesList.push(pair);
        }
    };

    collectCookies(handshakeResponse);

    const appResponse = await fetch(
        "https://h5.aoneroom.com/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox",
        {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${guestToken}`,
                Cookie: cookiesList.join("; "),
                "X-Client-Info": MOVIEBOX_CLIENT_INFO,
                "User-Agent": MOVIEBOX_USER_AGENT,
            },
            signal: AbortSignal.timeout(15_000),
        }
    );

    if (!appResponse.ok) throw new Error(`MovieBox app HTTP ${appResponse.status}`);
    collectCookies(appResponse);

    const uniqueCookies = new Map();
    for (const cookie of cookiesList) {
        uniqueCookies.set(cookie.split("=", 1)[0], cookie);
    }

    return {
        token: guestToken,
        cookies: [...uniqueCookies.values()].join("; "),
    };
}

async function movieBoxRequest(targetUrl, session, jsonBody = null) {
    const options = {
        method: jsonBody ? "POST" : "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`,
            Cookie: session.cookies,
            Referer: MOVIEBOX_DOWNLOAD_REFERER,
            "X-Client-Info": MOVIEBOX_CLIENT_INFO,
            "User-Agent": MOVIEBOX_USER_AGENT,
        },
        signal: AbortSignal.timeout(20_000),
    };

    if (jsonBody) {
        options.headers["Content-Type"] = "application/json";
        options.body = jsonBody;
    }

    const response = await fetch(targetUrl, options);
    if (!response.ok) throw new Error(`MovieBox HTTP ${response.status}`);
    return response.json();
}

function normalizeMovieBoxTitle(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function inferPlayableStreamType(url, format) {
    return /\.m3u8(?:\?|$)/i.test(String(url || "")) || /hls/i.test(String(format || ""))
        ? "M3U8"
        : "Direct";
}

function movieBoxFileScore(file) {
    const codec = String(file.codecName || file.codec || "").toLowerCase();
    const format = String(file.format || "").toLowerCase();
    const url = String(file.url || "").toLowerCase();
    let score = Number(file.resolution || 0);

    // Chromium/Safari reliably support AVC/H.264 MP4. Prefer those over a
    // nominally higher HEVC/unknown file that Android MPV can decode but the
    // browser may reject with MEDIA_ERR_SRC_NOT_SUPPORTED.
    if (/h264|avc/.test(codec)) score += 10_000;
    if (/h265|hevc|x265/.test(codec)) score -= 10_000;
    if (format === "mp4" || /\.mp4(?:\?|$)/.test(url)) score += 5_000;
    if (format === "hls" || /\.m3u8(?:\?|$)/.test(url)) score += 4_000;
    return score;
}

async function getStreams({ type, id, season, episode, title, year }) {
    const mediaTitle = String(title || "").trim();
    if (!mediaTitle) return [];

    try {
        const session = await createMovieBoxGuestSession();
        const subjectType = type === "tv" ? 2 : 1;
        const searchRes = await movieBoxRequest(
            `${MOVIEBOX_API}/subject/search`,
            session,
            JSON.stringify({ keyword: mediaTitle, page: 1, perPage: 20, subjectType })
        );
        if (!Array.isArray(searchRes?.data?.items)) return [];

        const wantedTitle = normalizeMovieBoxTitle(mediaTitle);
        const wantedYear = Number(String(year || "").slice(0, 4)) || 0;
        const candidates = searchRes.data.items.filter(item =>
            item.subjectType === subjectType && normalizeMovieBoxTitle(item.title) === wantedTitle
        );

        let selected = wantedYear
            ? candidates.find(item => Number(String(item.releaseDate || "").slice(0, 4)) === wantedYear)
            : null;
        if (!selected) selected = candidates[0];
        if (!selected?.subjectId || !selected?.detailPath) return [];

        const queryParams = new URLSearchParams({
            subjectId: String(selected.subjectId),
            se: type === "tv" ? String(season || 0) : "0",
            ep: type === "tv" ? String(episode || 0) : "0",
            detailPath: String(selected.detailPath),
        });

        const downloadRes = await movieBoxRequest(
            `${MOVIEBOX_API}/subject/download?${queryParams.toString()}`,
            session
        );
        if (!downloadRes?.data?.hasResource || !Array.isArray(downloadRes.data.downloads)) return [];

        const expectedDuration = Number(selected.duration || 0);
        const fullFiles = downloadRes.data.downloads
            .filter(file => {
                const minimumDuration = type === "movie" && expectedDuration > 0
                    ? expectedDuration * 0.7
                    : type === "tv"
                    ? 10 * 60
                    : 20 * 60;
                return /^https?:/i.test(String(file.url || "")) &&
                    Number(file.duration || 0) >= minimumDuration &&
                    Number(file.size || 0) >= 50 * 1024 * 1024;
            })
            .sort((a, b) => movieBoxFileScore(b) - movieBoxFileScore(a));

        if (!fullFiles.length) return [];

        const subtitles = Array.isArray(downloadRes.data.captions)
            ? downloadRes.data.captions.filter(caption => caption.url).map(caption => caption.url)
            : [];

        const playbackHeaders = {
            Accept: "*/*",
            Referer: MOVIEBOX_DOWNLOAD_REFERER,
            "User-Agent": MOVIEBOX_USER_AGENT,
        };

        // Return every full-length quality instead of only one file. Android
        // can decode more containers/codecs than browsers; exposing alternates
        // lets the web player fall back to a browser-compatible 720p/480p file
        // without abandoning MovieBox entirely.
        return fullFiles.map((file, index) => {
            const resolution = Number(file.resolution || 0);
            const size = Number(file.size || 0);
            const codec = String(file.codecName || file.codec || "H264").toUpperCase();
            const streamType = inferPlayableStreamType(file.url, file.format);
            const browserFriendly = !/HEVC|H265|X265/i.test(codec);

            return {
                id: `moviebox-web-${id}-${season || 0}-${episode || 0}-${file.id || index}`,
                title: mediaTitle,
                name: `Premium Source 4 ${resolution ? `${resolution}p` : "Auto"}`,
                provider: "Premium Source 4",
                source: "Premium Source 4",
                filename: `${mediaTitle} - ${resolution ? `${resolution}p` : "Auto"}`,
                quality: resolution ? `${resolution}p` : "Auto",
                codec,
                audio: String(file.audioCodec || "AAC").toUpperCase(),
                language: "Multi",
                subtitles,
                size: size ? `${(size / 1073741824).toFixed(2)} GB` : "Unknown",
                streamType,
                browserFriendly,
                rawText: `Full file - ${Math.floor(Number(file.duration || 0) / 60)} min ${codec}`,
                url: file.url,
                proxyHeaders: playbackHeaders,
            };
        });
    } catch (error) {
        console.error("MovieBox Web Scraper Error:", error?.message || error);
        return [];
    }
}

module.exports = { getStreams };
