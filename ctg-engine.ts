/* ============================================================
   CTG Engine
   Part 1
   Imports
   Types
   Roots
   Cache
   Fetcher
   Link Extractor
   Metadata Parser
   Normalizer
   Scoring
============================================================ */

import * as cheerio from "cheerio";

export interface CTGRoot {
    name: string;
    url: string;
}

export interface CTGCandidate {

    root: string;

    url: string;

    title: string;

    path: string;

    score: number;

    size?: string;

    quality?: string;

    language?: string;

    codec?: string;

    hdr?: boolean;

    audio?: string;

    season?: number;

    episode?: number;

    year?: number;

}

export interface SearchOptions {

    title: string;

    year?: number;

    imdb?: string;

    tmdb?: number;

    type: "movie" | "tv";

    season?: number;

    episode?: number;

}

const ROOTS: CTGRoot[] = [

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

const htmlCache = new Map<string, string>();

const fetchHeaders = {

    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",

    Accept:
        "text/html,application/xhtml+xml",

    Referer:
        "https://ftp.ctgfun.com"

};

async function fetchHTML(url: string): Promise<string> {

    if (htmlCache.has(url))
        return htmlCache.get(url)!;

    try {

        const res = await fetch(url, {
            headers: fetchHeaders
        });

        if (!res.ok)
            return "";

        const html = await res.text();

        htmlCache.set(url, html);

        return html;

    }

    catch {

        return "";

    }

}

function extractLinks(html: string, base: string): string[] {

    const $ = cheerio.load(html);

    const links: string[] = [];

    $("a").each((_, el) => {

        const href = ($(el).attr("href") || "").trim();

        if (!href)
            return;

        if (href.startsWith("?"))
            return;

        if (href.startsWith("#"))
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

function normalize(str: string): string {

    return str

        .toLowerCase()

        .replace(/\.[a-z0-9]{2,5}$/i, "")

        .replace(/[._-]/g, " ")

        .replace(/\s+/g, " ")

        .replace(/\(.*?\)/g, "")

        .trim();

}

function parseMetadata(name: string) {

    const n = normalize(name);

    const quality =

        n.match(/2160|4k/)
            ? "2160p"

        : n.match(/1080/)
            ? "1080p"

        : n.match(/720/)
            ? "720p"

        : "";

    const codec =

        /x265|hevc/.test(n)
            ? "HEVC"

        : /x264|h264/.test(n)
            ? "H264"

        : "";

    const hdr =
        /hdr|dolby.?vision|dv/.test(n);

    const audio =

        /atmos/.test(n)
            ? "Atmos"

        : /truehd/.test(n)
            ? "TrueHD"

        : /eac3/.test(n)
            ? "EAC3"

        : /aac/.test(n)
            ? "AAC"

        : "";

    const language =

        /multi/.test(n)
            ? "Multi"

        : /hindi/.test(n)
            ? "Hindi"

        : /english/.test(n)
            ? "English"

        : "";

    const season =
        Number(
            n.match(/s(\d{1,2})/)?.[1]
        );

    const episode =
        Number(
            n.match(/e(\d{1,2})/)?.[1]
        );

    const year =
        Number(
            n.match(/(19|20)\d{2}/)?.[0]
        );

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

function scoreCandidate(
    name: string,
    title: string
): number {

    const meta = parseMetadata(name);

    let score = 0;

    const a = normalize(name);
    const b = normalize(title);

    if (a.includes(b))
        score += 120;

    if (meta.quality === "2160p")
        score += 30;

    if (meta.quality === "1080p")
        score += 20;

    if (meta.quality === "720p")
        score += 10;

    if (meta.codec === "HEVC")
        score += 8;

    if (meta.audio === "AAC")
        score += 5;

    if (meta.audio === "Atmos")
        score += 6;

    if (meta.hdr)
        score += 5;

    return score;

}

/* ============================================================
   PART 2
   Queue
   Visited
   Parallel Crawler
   Candidate Collection
============================================================ */

const MAX_DEPTH = 8;
const MAX_CONCURRENT = 6;

async function crawlRoot(
    root: CTGRoot,
    options: SearchOptions
): Promise<CTGCandidate[]> {

    const queue: Array<{
        url: string;
        depth: number;
    }> = [
        {
            url: root.url,
            depth: 0
        }
    ];

    const visited = new Set<string>();

    const candidates: CTGCandidate[] = [];

    while (queue.length) {

        const batch = queue.splice(0, MAX_CONCURRENT);

        await Promise.all(
            batch.map(async ({ url, depth }) => {

                if (visited.has(url))
                    return;

                visited.add(url);

                if (depth > MAX_DEPTH)
                    return;

                const html = await fetchHTML(url);

                if (!html)
                    return;

                const links = extractLinks(html, url);

                for (const link of links) {

                    if (visited.has(link))
                        continue;

                    const pathname = decodeURIComponent(
                        new URL(link).pathname
                    );

                    const filename =
                        pathname.split("/").pop() || "";

                    if (isDirectory(link)) {

                        queue.push({
                            url: link,
                            depth: depth + 1
                        });

                        continue;
                    }

                    if (!isVideoFile(filename))
                        continue;

                    const score = scoreCandidate(
                        filename,
                        options.title
                    );

                    if (score < 120)
                        continue;

                    const meta = parseMetadata(filename);

                    candidates.push({
                        root: root.name,
                        url: link,
                        path: pathname,
                        title: filename,
                        score,
                        quality: meta.quality,
                        codec: meta.codec,
                        hdr: meta.hdr,
                        audio: meta.audio,
                        language: meta.language,
                        season: meta.season,
                        episode: meta.episode,
                        year: meta.year
                    });
                }

            })
        );
    }

    candidates.sort((a, b) => b.score - a.score);

    return candidates;
}

function isDirectory(url: string): boolean {

    try {

        const path = new URL(url).pathname;

        return path.endsWith("/");

    }

    catch {

        return false;

    }

}

function isVideoFile(name: string): boolean {

    return /\.(mkv|mp4|avi|mov|m4v|ts)$/i.test(name);

}

async function crawlAllRoots(
    options: SearchOptions
): Promise<CTGCandidate[]> {

    const results = await Promise.all(

        ROOTS.map(root =>
            crawlRoot(root, options)
        )

    );

    return results
        .flat()
        .sort((a, b) => b.score - a.score);

}

/* ============================================================
   PART 3
   Movie Search
   TV Search
   Metadata Filtering
   Stream Generation
============================================================ */

function movieMatches(
    candidate: CTGCandidate,
    options: SearchOptions
): boolean {

    const title = normalize(candidate.title);
    const wanted = normalize(options.title);

    if (!title.includes(wanted))
        return false;

    if (
        options.year &&
        candidate.year &&
        candidate.year !== options.year
    ) {
        return false;
    }

    return true;
}

function tvMatches(
    candidate: CTGCandidate,
    options: SearchOptions
): boolean {

    const title = normalize(candidate.title);
    const wanted = normalize(options.title);

    if (!title.includes(wanted))
        return false;

    if (
        options.season != null &&
        candidate.season != null &&
        candidate.season !== options.season
    ) {
        return false;
    }

    if (
        options.episode != null &&
        candidate.episode != null &&
        candidate.episode !== options.episode
    ) {
        return false;
    }

    return true;
}

function filterCandidates(
    candidates: CTGCandidate[],
    options: SearchOptions
): CTGCandidate[] {

    const filtered = candidates.filter(candidate => {

        if (options.type === "movie") {
            return movieMatches(candidate, options);
        }

        return tvMatches(candidate, options);

    });

    filtered.sort((a, b) => {

        if (b.score !== a.score)
            return b.score - a.score;

        const qa =
            Number(a.quality?.replace("p", "")) || 0;

        const qb =
            Number(b.quality?.replace("p", "")) || 0;

        return qb - qa;

    });

    return filtered;
}

function uniqueCandidates(
    candidates: CTGCandidate[]
): CTGCandidate[] {

    const seen = new Set<string>();

    return candidates.filter(candidate => {

        const key = [
            candidate.url,
            candidate.quality,
            candidate.audio,
            candidate.codec
        ].join("|");

        if (seen.has(key))
            return false;

        seen.add(key);

        return true;

    });

}

function buildStreams(
    candidates: CTGCandidate[]
) {

    return candidates.map(candidate => ({

        name: "CTG",

        title: [

            candidate.quality,

            candidate.codec,

            candidate.audio,

            candidate.language,

            candidate.hdr ? "HDR" : ""

        ]
            .filter(Boolean)
            .join(" • "),

        url: candidate.url,

        behaviorHints: {

            bingeGroup: "ctg"

        }

    }));

}

export async function searchCTG(
    options: SearchOptions
) {

    const crawled = await crawlAllRoots(options);

    const filtered = filterCandidates(
        crawled,
        options
    );

    const unique = uniqueCandidates(filtered);

    return buildStreams(unique);

}

/* ============================================================
   PART 4
   Helpers
   Cache
   Final Exports
============================================================ */

export function clearCTGCache(): void {
    htmlCache.clear();
}

export function getCTGRoots(): CTGRoot[] {
    return [...ROOTS];
}

export function getCandidateLabel(candidate: CTGCandidate): string {

    return [
        candidate.quality,
        candidate.codec,
        candidate.audio,
        candidate.language,
        candidate.hdr ? "HDR" : ""
    ]
        .filter(Boolean)
        .join(" • ");
}

export function sortCandidates(
    candidates: CTGCandidate[]
): CTGCandidate[] {

    return [...candidates].sort((a, b) => {

        if (b.score !== a.score) {
            return b.score - a.score;
        }

        const qa =
            parseInt(a.quality?.replace("p", "") || "0", 10);

        const qb =
            parseInt(b.quality?.replace("p", "") || "0", 10);

        return qb - qa;
    });

}

export {
    ROOTS,
    normalize,
    parseMetadata,
    scoreCandidate,
    fetchHTML,
    extractLinks
};