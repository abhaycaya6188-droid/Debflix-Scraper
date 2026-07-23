const https = require("https");
const http = require("http");
const url = require("url");

const MOVIEBOX_API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const MOVIEBOX_CLIENT_INFO = "{\"timezone\":\"Africa/Nairobi\"}";
const MOVIEBOX_DOWNLOAD_REFERER = "https://videodownloader.site/";
const MOVIEBOX_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Firefox/137.0";

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
    if (Array.isArray(tokenCookies)) {
        parsedTokenCookies = tokenCookies;
    } else if (typeof tokenCookies === 'string') {
        parsedTokenCookies = [tokenCookies];
    }
    
    let cookiesList = [];
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

    if (!appResponse.ok) {
        throw new Error(`MovieBox app HTTP ${appResponse.status}`);
    }

    const appCookies = appResponse.headers.get("set-cookie") || "";
    let parsedAppCookies = [];
    if (Array.isArray(appCookies)) {
        parsedAppCookies = appCookies;
    } else if (typeof appCookies === 'string') {
        parsedAppCookies = [appCookies];
    }
    
    for (const c of parsedAppCookies) {
        const pair = c.split(';')[0].trim();
        if (pair.includes('=')) cookiesList.push(pair);
    }
    
    // Deduplicate cookies
    const uniqueCookies = [];
    const seenKeys = new Set();
    for (const c of cookiesList) {
        const key = c.split('=')[0];
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueCookies.push(c);
        }
    }

    return {
        token: guestToken,
        cookies: uniqueCookies.join("; ")
    };
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
    if (!res.ok) {
        throw new Error(`MovieBox HTTP ${res.status}`);
    }
    
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
        
        const searchBody = JSON.stringify({
            keyword: mediaTitle,
            page: 1,
            perPage: 20,
            subjectType: subjectType
        });
        
        const searchRes = await movieBoxRequest(`${MOVIEBOX_API}/subject/search`, session, searchBody);
        if (!searchRes || !searchRes.data || !searchRes.data.items) return [];
        
        const items = searchRes.data.items;
        const wantedTitle = normalizeMovieBoxTitle(mediaTitle);
        const wantedYear = year ? parseInt(String(year).substring(0, 4)) : null;
        
        let candidates = items.filter(it => it.subjectType === subjectType && normalizeMovieBoxTitle(it.title) === wantedTitle);
        
        let selected = null;
        if (wantedYear) {
            selected = candidates.find(it => {
                const release = it.releaseDate || "";
                return parseInt(release.substring(0, 4)) === wantedYear;
            });
        }
        if (!selected) {
            selected = candidates[0];
        }
        
        if (!selected) return [];
        
        const subjectId = selected.subjectId;
        const detailPath = selected.detailPath;
        if (!subjectId || !detailPath) return [];
        
        const expectedDuration = selected.duration || 0;
        
        const queryParams = new URLSearchParams({
            subjectId: subjectId,
            se: type === "tv" ? (season || 0) : 0,
            ep: type === "tv" ? (episode || 0) : 0,
            detailPath: detailPath
        });
        
        const downloadRes = await movieBoxRequest(`${MOVIEBOX_API}/subject/download?${queryParams.toString()}`, session);
        if (!downloadRes || !downloadRes.data || !downloadRes.data.hasResource || !downloadRes.data.downloads) return [];
        
        const downloads = downloadRes.data.downloads;
        let fullFiles = downloads.filter(file => {
            const duration = file.duration || 0;
            const size = file.size || 0;
            let minimumDuration = 0;
            
            if (type === "movie" && expectedDuration > 0) {
                minimumDuration = (expectedDuration * 7) / 10;
            } else if (type === "tv") {
                minimumDuration = 10 * 60;
            } else {
                minimumDuration = 20 * 60;
            }
            
            const urlStr = file.url || "";
            return urlStr.startsWith("http") && duration >= minimumDuration && size >= 50 * 1024 * 1024;
        });
        
        if (fullFiles.length === 0) return [];
        
        // Find best resolution
        let best = fullFiles[0];
        for (const file of fullFiles) {
            if ((file.resolution || 0) > (best.resolution || 0)) {
                best = file;
            }
        }
        
        const streamUrl = best.url;
        const duration = best.duration || 0;
        const resolution = best.resolution || 0;
        const sizeBytes = best.size || 0;
        
        const subtitles = [];
        if (downloadRes.data.captions && Array.isArray(downloadRes.data.captions)) {
            for (const caption of downloadRes.data.captions) {
                if (caption.url) subtitles.push(caption.url);
            }
        }
        
        const playbackHeaders = {
            "Accept": "*/*",
            "Origin": "https://h5.aoneroom.com",
            "Referer": MOVIEBOX_DOWNLOAD_REFERER,
            "User-Agent": MOVIEBOX_USER_AGENT
        };
        
        let sizeStr = "Unknown";
        if (sizeBytes > 0) {
            sizeStr = (sizeBytes / 1073741824).toFixed(2) + " GB";
        }
        
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
            subtitles: subtitles,
            size: sizeStr,
            streamType: inferPlayableStreamType(streamUrl, best.format),
            browserFriendly: true,
            rawText: `Full file - ${Math.floor(duration / 60)} min`,
            url: streamUrl,
            proxyHeaders: playbackHeaders
        }];
        
    } catch (error) {
        console.error("MovieBox Web Scraper Error:", error.message);
        return [];
    }
}

module.exports = {
    getStreams
};
