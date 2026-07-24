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

function movieBoxCodecInfo(file) {
    const video = String(file.codecName || file.codec || "").toLowerCase();
    const audio = String(file.audioCodec || file.audio_codec || "").toLowerCase();
    const format = String(file.format || "").toLowerCase();
    const url = String(file.url || "").toLowerCase();

    const isH264 = /h264|avc/.test(video);
    const isHevc = /h265|hevc|x265/.test(video);
    const isMp4 = format === "mp4" || /\.mp4(?:\?|$)/.test(url);
    const isHls = format === "hls" || /\.m3u8(?:\?|$)/.test(url);
    const hasSafeAudio = !audio || /aac|mp3|mpeg/.test(audio);
    const hasRiskyAudio = /eac3|ec-3|ac3|ac-3|dts|truehd|opus|flac/.test(audio);

    return {
        video,
        audio,
        isH264,
        isHevc,
        isMp4,
        isHls,
        hasSafeAudio,
        hasRiskyAudio,
        browserFriendly: (isH264 && isMp4 && hasSafeAudio) || isHls,
    };
}

function movieBoxFileScore(file) {
    const info = movieBoxCodecInfo(file);
    let score = Number(file.resolution || 0);

    // A browser-compatible file must include both a supported video codec and
    // a supported audio codec. H.264 video with AC3/EAC3/DTS still produces
    // MEDIA_ELEMENT_ERROR code 4 in Chromium even though the video label says
    // H264. Prefer complete AVC+AAC MP4 combinations first.
    if (info.browserFriendly) score += 30_000;
    if (info.isH264) score += 10_000;
    if (info.isHevc) score -= 10_000;
    if (info.isMp4) score += 5_000;
    if (info.isHls) score += 4_000;
    if (info.hasSafeAudio) score += 8_000;
    if (info.hasRiskyAudio) score -= 15_000;

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

        return fullFiles.map((file, index) => {
            const resolution = Number(file.resolution || 0);
            const size = Number(file.size || 0);
            const info = movieBoxCodecInfo(file);
            const codec = String(file.codecName || file.codec || "H264").toUpperCase();
            const audio = String(file.audioCodec || file.audio_codec || "AAC").toUpperCase();
            const streamType = inferPlayableStreamType(file.url, file.format);

            return {
                id: `moviebox-web-${id}-${season || 0}-${episode || 0}-${file.id || index}`,
                title: mediaTitle,
                name: `Premium Source 4 ${resolution ? `${resolution}p` : "Auto"}`,
                provider: "Premium Source 4",
                source: "Premium Source 4",
                filename: `${mediaTitle} - ${resolution ? `${resolution}p` : "Auto"}`,
                quality: resolution ? `${resolution}p` : "Auto",
                codec,
                audio,
                language: "Multi",
                subtitles,
                size: size ? `${(size / 1073741824).toFixed(2)} GB` : "Unknown",
                streamType,
                browserFriendly: info.browserFriendly,
                rawText: `Full file - ${Math.floor(Number(file.duration || 0) / 60)} min ${codec}/${audio}`,
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
