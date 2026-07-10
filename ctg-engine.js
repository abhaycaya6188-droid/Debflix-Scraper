/* ============================================================
   CTG ENGINE
   PART 1
============================================================ */

const cheerio = require("cheerio");

const ROOTS = [

    {
        name: "FTP",
        url: "https://ftp.ctgfun.com"
    },

    {
        name: "Movie",
        url: "https://movie.ctgfun.com"
    },

    {
        name: "Data",
        url: "https://data.ctgfun.com"
    },

    {
        name: "Series",
        url: "https://series.ctgfun.com"
    },

    {
        name: "Archive",
        url: "https://archive.ctgfun.com"
    }

];

const CACHE = new Map();

const HEADERS = {

    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",

    Accept:
        "text/html,application/xhtml+xml",

    Referer:
        "https://ftp.ctgfun.com"

};

async function fetchHTML(url) {

    if (CACHE.has(url))
        return CACHE.get(url);

    try {

        const res = await fetch(url, {
            headers: HEADERS
        });

        if (!res.ok)
            return "";

        const html = await res.text();

        CACHE.set(url, html);

        return html;

    }

    catch {

        return "";

    }

}

function clearCache() {

    CACHE.clear();

}

function normalize(text) {

    return String(text || "")

        .toLowerCase()

        .replace(/\.[a-z0-9]{2,5}$/i, "")

        .replace(/[._-]/g, " ")

        .replace(/\(.*?\)/g, "")

        .replace(/\[.*?\]/g, "")

        .replace(/\s+/g, " ")

        .trim();

}

function extractLinks(html, base) {

    const $ = cheerio.load(html);

    const links = [];

    $("a").each((_, a) => {

        const href =
            ($(a).attr("href") || "").trim();

        if (!href)
            return;

        if (href.startsWith("#"))
            return;

        if (href.startsWith("?"))
            return;

        if (href === "../")
            return;

        try {

            links.push(
                new URL(href, base).href
            );

        }

        catch {}

    });

    return [...new Set(links)];

}

function parseMetadata(name) {

    const file = normalize(name);

    const quality =
        file.match(/2160|4k/)
            ? "2160p"
        : file.match(/1080/)
            ? "1080p"
        : file.match(/720/)
            ? "720p"
        : file.match(/480/)
            ? "480p"
        : "";

    const codec =
        /hevc|x265/.test(file)
            ? "HEVC"
        : /h264|x264/.test(file)
            ? "H264"
        : "";

    const hdr =
        /hdr|dolby.?vision|dv/.test(file);

    const audio =
        /atmos/.test(file)
            ? "Atmos"
        : /truehd/.test(file)
            ? "TrueHD"
        : /eac3/.test(file)
            ? "EAC3"
        : /aac/.test(file)
            ? "AAC"
        : "";

    const language =
        /multi/.test(file)
            ? "Multi"
        : /hindi/.test(file)
            ? "Hindi"
        : /english/.test(file)
            ? "English"
        : "";

    const season =
        Number(file.match(/s(\d{1,2})/)?.[1]);

    const episode =
        Number(file.match(/e(\d{1,2})/)?.[1]);

    const year =
        Number(file.match(/(19|20)\d{2}/)?.[0]);

    return {

        quality,

        codec,

        hdr,

        audio,

        language,

        season:
            Number.isFinite(season)
                ? season
                : undefined,

        episode:
            Number.isFinite(episode)
                ? episode
                : undefined,

        year:
            Number.isFinite(year)
                ? year
                : undefined

    };

}

function score(name, wanted) {

    const meta =
        parseMetadata(name);

    let s = 0;

    const a = normalize(name);
    const b = normalize(wanted);

    if (a.includes(b))
        s += 120;

    if (meta.quality === "2160p")
        s += 30;

    if (meta.quality === "1080p")
        s += 20;

    if (meta.quality === "720p")
        s += 10;

    if (meta.codec === "HEVC")
        s += 8;

    if (meta.audio === "AAC")
        s += 5;

    if (meta.audio === "Atmos")
        s += 6;

    if (meta.hdr)
        s += 5;

    return s;

}

