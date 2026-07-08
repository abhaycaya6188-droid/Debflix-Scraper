
const cinecloud = require("./cinecloud");
const cheerio = require("cheerio");

const BASE = "https://cinefreak.nl";

const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    Cookie: "xla=s4t",
};

async function search(title) {

    const url =
        `${BASE}/search-api.php?q=${encodeURIComponent(title)}&pg=1`;

    const res = await fetch(url, {
        headers: HEADERS,
    });

    const json = await res.json();

    return json.results || [];
}

async function page(slug) {

    const url =
        `${BASE}/${slug}/`;

    console.log("[CINEFREAK] PAGE:", url);

    const res = await fetch(url, {
    headers: HEADERS,
});

const html = await res.text();   // <-- THIS IS MISSING

const fs = require("fs");
const path = require("path");

fs.writeFileSync(
    path.join(__dirname, "movie-page.html"),
    html
);

console.log("HTML LENGTH:", html.length);

console.log("FIRST 1500 CHARS:");
console.log(html.substring(0, 1500));

console.log("HAS movie-title:", html.includes("movie-title"));
console.log("HAS episode-grid:", html.includes("episode-grid"));
console.log("HAS ep-card:", html.includes("ep-card"));
console.log("HAS dlbtn-container:", html.includes("dlbtn-container"));
console.log("HAS Download Links:", html.includes("Download Links"));
console.log("HAS Watch Online:", html.includes("Watch Online"));
console.log("HAS Cloudflare:", html.includes("Cloudflare"));
console.log("HAS Just a moment:", html.includes("Just a moment"));
console.log("Saved:", path.join(__dirname, "movie-page.html"));

    const $ = cheerio.load(html);

const releases = [];

$(".ep-card").each((i, card) => {

    const episode =
        $(card)
            .find(".episode-badge")
            .text()
            .trim();

    $(card)
        .find(".watch-links a")
        .each((j, a) => {

            const href = $(a).attr("href");

            if (!href)
                return;

            const full =
                href.startsWith("http")
                    ? href
                    : BASE + href;

            const encoded =
                new URL(full)
                    .searchParams
                    .get("id");

            if (!encoded)
                return;

            const decoded =
                Buffer
                    .from(encoded, "base64")
                    .toString("utf8")
                    .replace(/newgo32$/i, "");

            releases.push({

                episode,

                title: $(a).text().trim(),

                quality: $(a).text().match(/2160p|1080p|720p|480p/i)?.[0] || "",

                codec: $(a).text().match(/HEVC|HDR|AV1|H\.?264/i)?.[0] || "",

                watch: decoded

            });

        });

});

console.log("[CINEFREAK] RELEASES FOUND:", releases.length);
console.dir(releases, { depth: null });

return {

    count: releases.length,

    links: releases

};
}


async function generate(generateUrl) {

    console.log("[CINEFREAK] Generate:", generateUrl);

    const res = await fetch(generateUrl, {
        headers: HEADERS,
        redirect: "manual"
    });

    const body = await res.text();

    return {
        status: res.status,
        location: res.headers.get("location"),
        headers: Object.fromEntries(res.headers.entries()),
        body
    };

}

async function inspectFile(url) {

    console.log("[CINEFREAK] FILE:", url);

    const res = await fetch(url, {
        headers: HEADERS,
        redirect: "manual"
    });

    const body = await res.text();

    return {
        url: res.url,
        status: res.status,
        location: res.headers.get("location"),
        headers: Object.fromEntries(res.headers.entries()),
        body
    };
}

async function resolve(slug) {
    console.log(">>>>>>>> ENTERED RESOLVE <<<<<<<<");

    const pageResult = await page(slug);
    console.log(">>>>>>>> PAGE FINISHED <<<<<<<<");
console.dir(pageResult, { depth: null });

    if (!pageResult.links.length) {
        return {
            success: false,
            error: "No releases found"
        };
    }

    // Best quality first
    const releases = [...pageResult.links].sort((a, b) => {

        const score = r => {

            let s = 0;

            if (r.quality === "2160p") s += 400;
            else if (r.quality === "1080p") s += 300;
            else if (r.quality === "720p") s += 200;
            else if (r.quality === "480p") s += 100;

            if (r.codec === "HEVC") s += 50;
            if (r.codec === "HDR") s += 40;
            if (r.codec === "HD") s += 20;

            return s;
        };

        return score(b) - score(a);

    });

    const best = releases[0];

console.log("[CINEFREAK] Default:", best.title);

console.log("========== BEST RELEASE ==========");
console.log(best);

const browser = require("./cinecloud-browser");

console.log("========== WATCH URL ==========");
console.log(best.watch);

const result = await browser.resolve(best.watch);

console.dir(result, { depth: null });

if (!result.success) {
    return result;
}

return {

    success: true,

    default: {

        stream: result.stream,

        subtitles: result.subtitles,

        quality: best.quality,

        codec: best.codec

    },

    qualities: releases.map(r => ({

        episode: r.episode,

        quality: r.quality,

        codec: r.codec,

        title: r.title,

        watch: r.watch

    }))

};

}

async function resolveQualities(slug) {

    const pageResult = await page(slug);

    if (!pageResult.links.length) {
        return {
            success: false,
            error: "No releases found"
        };
    }

    // Skip the default release (already used for playback)
    const releases = pageResult.links.slice(1);

    return {

        success: true,

        qualities: releases.map(release => ({

    episode: release.episode,

    quality: release.quality,

    codec: release.codec,

    title: release.title,

    watch: release.watch

}))

    };

}

module.exports = {
    search,
    page,
    resolve,
    resolveQualities
};