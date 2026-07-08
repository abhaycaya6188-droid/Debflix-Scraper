
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

    const html = await res.text();
    const fs = require("fs");
const path = require("path");

fs.writeFileSync(
    path.join(__dirname, "movie-page.html"),
    html
);

console.log("Saved:", path.join(__dirname, "movie-page.html"));

    const $ = cheerio.load(html);
    console.log("MOVIE TITLES:", $("h4.movie-title").length);
console.log("DL CONTAINERS:", $(".dlbtn-container").length);
console.log("ALL H4:", $("h4").length);
console.log("ALL A:", $("a").length);

$("h4").each((i, el) => {
    console.log("H4:", $(el).text().trim());
});

const releases = [];

$("h4.movie-title").each((i, titleEl) => {

    const container =
        $(titleEl).next(".dlbtn-container");

    if (!container.length)
        return;

    const download =
        container.find("a:contains('Download Links')");

    if (!download.length)
        return;

    const href =
        download.attr("href");

    const full =
        href.startsWith("http")
            ? href
            : BASE + href;
console.log("DOWNLOAD URL:", full);


    const id =
        new URL(full)
            .searchParams
            .get("id");

    const decoded =
        Buffer
            .from(id, "base64")
            .toString("utf8")
            .replace(/newgo32$/i, "");

    const title =
        $(titleEl)
            .text()
            .replace(/\s+/g, " ")
            .trim();

    const quality =
        title.match(/2160p|1080p|720p|480p/i)?.[0] || "";

    const codec =
        title.match(/HEVC|HDR|HD|SD/i)?.[0] || "";

    const brackets =
    [...title.matchAll(/\[(.*?)\]/g)]
        .map(x => x[1]);

const size =
    brackets.at(-1) || "";
    releases.push({

        title,

        quality,

        codec,

        size,

        generate: full,

        decoded

    });

});

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

console.log("========== DECODED ==========");
console.log(best.decoded);

const id = best.decoded.split("/").pop();

console.log("========== ID ==========");
console.log(id);

console.log("========== CINECLOUD URL ==========");
console.log(`https://new5.cinecloud.site/w/${id}`);

let result;

try {

    result = await cinecloud.generate(
        `https://new5.cinecloud.site/w/${id}`
    );

    console.log("========== GENERATE RESULT ==========");
    console.dir(result, { depth: null });

} catch (e) {


    console.error("CINECLOUD GENERATE FAILED");
    console.error(e);

    return {
        success: false,
        error: e.message
    };

}

    if (!result.success) {
        return result;
    }

    return {

        success: true,

        default: {

            stream: result.stream,

            quality: best.quality,

            codec: best.codec,

            size: best.size

        },

        qualities: releases.map(r => ({

            id: r.decoded.split("/").pop(),

            quality: r.quality,

            codec: r.codec,

            size: r.size,

            title: r.title

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

            id: release.decoded.split("/").pop(),

            quality: release.quality,

            codec: release.codec,

            size: release.size,

            title: release.title

        }))

    };

}

module.exports = {
    search,
    page,
    resolve,
    resolveQualities
};