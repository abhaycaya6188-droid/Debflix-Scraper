/* ============================================================
   CTG Parser
   Filename Metadata Parser
============================================================ */

const VIDEO_EXTENSIONS = [
    "mkv",
    "mp4",
    "avi",
    "mov",
    "m4v",
    "ts",
    "m2ts",
    "wmv",
    "webm",
    "iso"
];

function normalize(text) {

    return String(text || "")

        .replace(/\.[a-z0-9]{2,5}$/i, "")

        .replace(/[._-]/g, " ")

        .replace(/\s+/g, " ")

        .trim()

        .toLowerCase();

}

function safeDecode(value = "") {

    try {

        return decodeURIComponent(value);

    } catch {

        return value;

    }

}

function extension(filename) {

    const match =
        filename.match(/\.([a-z0-9]+)$/i);

    if (!match)
        return "";

    return match[1].toLowerCase();

}

function isVideo(filename) {

    return VIDEO_EXTENSIONS.includes(
        extension(filename)
    );

}

function detectQuality(name) {

    if (/4320|8k/i.test(name))
        return "4320p";

    if (/2160|4k/i.test(name))
        return "2160p";

    if (/1440/i.test(name))
        return "1440p";

    if (/1080/i.test(name))
        return "1080p";

    if (/720/i.test(name))
        return "720p";

    if (/480/i.test(name))
        return "480p";

    return "";

}

function detectCodec(name) {

    if (/x265|hevc/i.test(name))
        return "HEVC";

    if (/x264|h264|avc/i.test(name))
        return "H264";

    if (/xvid/i.test(name))
        return "XVID";

    return "";

}

function detectHDR(name) {

    return /hdr|hdr10|hdr10\+|dolby.?vision|dv/i.test(name);

}

function detectAudio(name) {

    if (/atmos/i.test(name))
        return "Atmos";

    if (/truehd/i.test(name))
        return "TrueHD";

    if (/dts.?hd/i.test(name))
        return "DTS-HD";

    if (/dts/i.test(name))
        return "DTS";

    if (/eac3|ddp/i.test(name))
        return "EAC3";

    if (/ac3/i.test(name))
        return "AC3";

    if (/aac/i.test(name))
        return "AAC";

    return "";

}

function detectLanguage(name) {

    const languages = [];

    if (/english/i.test(name))
        languages.push("English");

    if (/hindi/i.test(name))
        languages.push("Hindi");

    if (/tamil/i.test(name))
        languages.push("Tamil");

    if (/telugu/i.test(name))
        languages.push("Telugu");

    if (/malayalam/i.test(name))
        languages.push("Malayalam");

    if (/kannada/i.test(name))
        languages.push("Kannada");

    if (/multi/i.test(name))
        return "Multi";

    if (/dual/i.test(name))
        return "Dual";

    return languages.join(", ");

}
/* ============================================================
   PART 2
   Metadata Detection
============================================================ */

function detectYear(name) {

    const match = name.match(/\b(19\d{2}|20\d{2})\b/);

    return match ? Number(match[1]) : null;

}

function detectSeasonEpisode(name) {

    
    

    const se = name.match(
        /S\s*(\d{1,2})\s*E\s*(\d{1,2})/i
    );

   

    if (se) {

        return {

            season: Number(se[1]),
            episode: Number(se[2])

        };

    }

    return {

        season: null,
        episode: null

    };

}
function detectSource(name) {

    if (/remux/i.test(name))
        return "REMUX";

    if (/bluray|blu-ray|bdrip/i.test(name))
        return "BluRay";

    if (/web[- ]?dl/i.test(name))
        return "WEB-DL";

    if (/webrip/i.test(name))
        return "WEBRip";

    if (/hdrip/i.test(name))
        return "HDRip";

    if (/dvdrip/i.test(name))
        return "DVDRip";

    if (/cam/i.test(name))
        return "CAM";

    return "";

}

function detectType(meta) {

    if (meta.season !== null || meta.episode !== null)
        return "tv";

    return "movie";

}

function cleanTitle(filename) {

    let title = filename;

    title = title.replace(/\.[a-z0-9]{2,5}$/i, "");

    title = title.replace(/[._]/g, " ");

    title = title.replace(/\b(19\d{2}|20\d{2})\b.*$/i, "");

    title = title.replace(
    /\b(S\s*\d{1,2}\s*E\s*\d{1,2}|\d{1,2}x\d{1,2})\b.*$/i,
    ""
);

    title = title.replace(
        /\b(2160p|1080p|720p|480p|4k)\b.*$/i,
        ""
    );

    title = title
    .replace(/\s*\(\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

return title;
}

function titleFromPath(fullPath = "") {

    const decodedPath = safeDecode(fullPath || "");

const parts = decodedPath
    .split("/")
    .filter(Boolean);

    const tvIndex = parts.findIndex(
        p => p.toLowerCase() === "tv_series"
    );

    if (tvIndex === -1)
        return "";

    if (parts.length <= tvIndex + 1)
        return "";

    let title = parts[tvIndex + 1];

    title = title
        .replace(/season\s*\d+/i, "")
        .replace(/s\d+$/i, "")
        .trim();

    return title;

}

function parse(filename, fullPath = "") {

    const decodedPath = safeDecode(fullPath);

const searchText =
    decodedPath +
    " " +
    filename;




    const normalized =
        normalize(searchText);

        const seasonEpisode =
    detectSeasonEpisode(searchText);

    const meta = {

        filename,

        extension: extension(filename),

        isVideo: isVideo(filename),

        title: cleanTitle(filename) || titleFromPath(fullPath),

        normalizedTitle: normalize(
    cleanTitle(filename) || titleFromPath(fullPath)
),

        year: detectYear(searchText),


        season: seasonEpisode.season,

        episode: seasonEpisode.episode,

        quality: detectQuality(normalized),

        codec: detectCodec(normalized),

hdr: detectHDR(normalized),

audio: detectAudio(normalized),

language: detectLanguage(normalized),

source: detectSource(normalized)
    };

    meta.type = detectType(meta);

    return meta;

}

/* ============================================================
   PART 3
   Helpers
   Validation
   Exports
============================================================ */

function detectSize(name) {

    const match = name.match(
        /(\d+(?:\.\d+)?)\s*(GB|MB|GiB|MiB)/i
    );

    if (!match)
        return "";

    return `${match[1]} ${match[2].toUpperCase()}`;
}

function detectReleaseGroup(name) {

    const match = name.match(/-([A-Za-z0-9]+)$/);

    return match ? match[1] : "";
}

function isTV(filename) {

    const meta = parse(filename);

    return meta.type === "tv";

}

function isMovie(filename) {

    const meta = parse(filename);

    return meta.type === "movie";

}

function validate(meta) {

    if (!meta)
        return false;

    if (!meta.isVideo)
        return false;

    if (!meta.title)
        return false;

    return true;

}

module.exports = {

    parse,

    normalize,

    extension,

    isVideo,

    isMovie,

    isTV,

    validate,

    detectQuality,

    detectCodec,

    detectHDR,

    detectAudio,

    detectLanguage,

    detectYear,

    detectSeasonEpisode,

    detectSource,

    detectSize,

    detectReleaseGroup,

    cleanTitle

};