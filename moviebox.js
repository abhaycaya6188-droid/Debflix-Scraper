const https = require("https");
const http = require("http");
const url = require("url");

const MOVIEBOX_API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const MOVIEBOX_CLIENT_INFO = "{\"timezone\":\"Africa/Nairobi\"}";
const MOVIEBOX_DOWNLOAD_REFERER = "https://videodownloader.site/";
const MOVIEBOX_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

async function createMovieBoxGuestSession() {
    const handshakeResponse = await fetch(`${MOVIEBOX_API}/subject/search-suggest`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Client-Info': MOVIEBOX_CLIENT_INFO,
            'User-Agent': MOVIEBOX_USER_AGENT
        },
        body: JSON.stringify({ keyword: "avatar", perPage: 0 })
    });

    if (!handshakeResponse.ok) {
        throw new Error(`MovieBox guest HTTP ${handshakeResponse.status}`);
    }

    const xUserHeader = handshakeResponse.headers.get("x-user");
    let guestToken = "";
    if (xUserHeader) {
        try {
            const userObj = JSON.parse(xUserHeader);
            guestToken = userObj.token || "";
        } catch (e) {}
    }

    if (!guestToken) {
        throw new Error("MovieBox guest token missing");
    }

    const tokenCookies = handshakeResponse.headers.get("set-cookie") || "";
    let parsedTokenCookies = [];
    if (Array.isArray(tokenCookies)) parsedTokenCookies = tokenCookies;
    else if (typeof tokenCookies === 'string') parsedTokenCookies = [tokenCookies];

    const cookiesList = [];
    for (const c of parsedTokenCookies) {
        const pair = c.split(';')[0].trim();
        if (pair.includes('=')) cookiesList.push(pair);
    }
    const tokenCookieString = cookiesList.join("; ");

    const appResponse = await fetch("https://h5.aoneroom.com/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox", {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${guestToken}`,
            'Cookie': tokenCookieString,
            'X-Client-Info': MOVIEBOX_CLIENT_INFO,
            'User-Agent': MOVIEBOX_USER_AGENT
        }
    });

    if (!appResponse.ok) throw new Error(`MovieBox app HTTP ${appResponse.status}`);

    const appCookies = appResponse.headers.get("set-cookie") || "";
    const parsedAppCookies = Array.isArray(appCookies)
        ? appCookies
        : typeof appCookies === 'string'
        ? [appCookies]
        : [];

    for (const c of parsedAppCookies) {
        const pair = c.split(';')[0].trim();
        if (pair.includes('=')) cookiesList.push(pair);
    }

    const uniqueCookies = [];
    const seenKeys = new Set();
    for (const c of cookiesList) {
        const key = c.split('=')[0];
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueCookies.push(c);
        }
    }

    return { token: guestToken, cookies: uniqueCookies.join("; ") };
}

async function movieBoxRequest(targetUrl, session, jsonBody = null) {
    const options = {
        method: jsonBody ? 'POST' : 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${session.token}`,
            'Cookie': session.cookies,
            'Referer': MOVIEBOX_DOWNLOAD_REFERER,
            'X-Client-Info': MOVIEBOX_CLIENT_INFO,
            'User-Agent': MOVIEBOX_USER_AGENT
        }
    };

    if (jsonBody) {
        options.headers['Content-Type'] = 'application/json';
        options.body = jsonBody;
    }

    const res = await fetch(targetUrl, options);
    if (!res.ok) throw new Error(`MovieBox HTTP ${res.status}`);
    return await res.json();
}

function normalizeMovieBoxTitle(value) {
    if (!value) return "";
    return value.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferPlayableStreamType(urlStr, format) {
    if (urlStr.includes(".m3u8") || format?.toLowerCase() === "hls") return "M3U8";
    return "Direct";
}

async function getStreams({ type, id, season, episode, title, year }) {
    const mediaTitle = title ? title.trim() : "";
    if (!mediaTitle) return [];

    try {
        const session = await createMovieBoxGuestSession();
        const subjectType = type === "tv" ? 2 : 1;
        const searchBody = JSON.stringify({ keyword: mediaTitle, page: 1, perPage: 20, subjectType });
        const searchRes = await movieBoxRequest(`${MOVIEBOX_API}/subject/search`, session, searchBody);
        if (!searchRes?.data?.items) return [];

        const wantedTitle = normalizeMovieBoxTitle(mediaTitle);
        const wantedYear = year ? parseInt(String(year).substring(0, 4)) : null;
        const candidates = searchRes.data.items.filter(
            it => it.subjectType === subjectType && normalizeMovieBoxTitle(it.title) === wantedTitle
        );

        let selected = wantedYear
            ? candidates.find(it => parseInt(String(it.releaseDate || "").substring(0, 4)) === wantedYear)
            : null;
        if (!selected) selected = candidates[0];
        if (!selected?.subjectId || !selected?.detailPath) return [];

        const queryParams = new URLSearchParams({
            subjectId: selected.subjectId,
            se: type === "tv" ? (season || 0) : 0,
            ep: type === "tv" ? (episode || 0) : 0,
            detailPath: selected.detailPath
        });

        const downloadRes = await movieBoxRequest(`${MOVIEBOX_API}/subject/download?${queryParams.toString()}`, session);
        if (!downloadRes?.data?.hasResource || !Array.isArray(downloadRes.data.downloads)) return [];

        const expectedDuration = selected.duration || 0;
        const fullFiles = downloadRes.data.downloads.filter(file => {
            const minimumDuration = type === "movie" && expectedDuration > 0
                ? (expectedDuration * 7) / 10
                : type === "tv"
                ? 10 * 60
                : 20 * 60;
            return String(file.url || "").startsWith("http") &&
                (file.duration || 0) >= minimumDuration &&
                (file.size || 0) >= 50 * 1024 * 1024;
        });
        if (!fullFiles.length) return [];

        const best = fullFiles.reduce((selectedFile, file) =>
            (file.resolution || 0) > (selectedFile.resolution || 0) ? file : selectedFile
        );

        const subtitles = Array.isArray(downloadRes.data.captions)
            ? downloadRes.data.captions.filter(caption => caption.url).map(caption => caption.url)
            : [];

        // The signed CDN accepts the downloader referer and matching browser UA.
        // Sending an Origin header makes some bcdn* hosts return a non-media body
        // with HTTP 200, which browsers report as MEDIA_ELEMENT_ERROR code 4.
        const playbackHeaders = {
            "Accept": "*/*",
            "Referer": MOVIEBOX_DOWNLOAD_REFERER,
            "User-Agent": MOVIEBOX_USER_AGENT
        };

        const sizeStr = best.size > 0 ? (best.size / 1073741824).toFixed(2) + " GB" : "Unknown";
        const resolution = best.resolution || 0;

        return [{
            id: `moviebox-web-${id}-${season || 0}-${episode || 0}-${best.id || ""}`,
            title: mediaTitle,
            name: "Premium Source 4",
            provider: "Premium Source 4",
            source: "Premium Source 4",
            filename: `${mediaTitle} - ${resolution}p`,
            quality: resolution > 0 ? `${resolution}p` : "Auto",
            codec: (best.codecName || "H264").toUpperCase(),
            audio: "AAC",
            language: "Multi",
            subtitles,
            size: sizeStr,
            streamType: inferPlayableStreamType(best.url, best.format),
            browserFriendly: true,
            rawText: `Full file - ${Math.floor((best.duration || 0) / 60)} min`,
            url: best.url,
            proxyHeaders: playbackHeaders
        }];
    } catch (error) {
        console.error("MovieBox Web Scraper Error:", error.message);
        return [];
    }
}

module.exports = { getStreams };
