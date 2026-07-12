/* ============================================================
   CTG Crawler
   Apache AutoIndex Crawler
============================================================ */

const cheerio = require("cheerio");

const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    Accept: "text/html"
};

async function fetchDirectory(url) {

    const referer =
        new URL(url).origin + "/";

    const res = await fetch(url, {

        headers: {

            ...HEADERS,

            Referer: referer

        }

    });

    if (!res.ok) {

        throw new Error(
            `HTTP ${res.status}: ${url}`
        );

    }

    return await res.text();

}
function resolveURL(base, href) {

    try {

        return new URL(href, base).href;

    }

    catch {

        return null;

    }

}

function classify(name) {

    const lower =
        name.toLowerCase();

    if (lower.endsWith("/"))
        return "directory";

    if (/\.(mp4|mkv|avi|mov|m4v|ts|m2ts|wmv|webm|iso)$/i.test(name))
        return "video";

    if (/\.(srt|ass|ssa|sub)$/i.test(name))
        return "subtitle";

    if (/\.(jpg|jpeg|png|gif|bmp|webp|nfo|txt|zip|rar|7z|pdf)$/i.test(name))
        return "ignore";

    return "ignore";

}

function parseDirectory(html, baseURL) {

    const $ = cheerio.load(html);

    const entries = [];

    // -------------------------------------------------
    // Apache AutoIndex (table layout)
    // -------------------------------------------------

    if ($("table tr").length) {

        $("table tr").each((_, row) => {

            const link = $(row).find("a").first();

            if (!link.length)
                return;

            const href = link.attr("href");

            if (!href)
                return;

            if (href === "../")
                return;

            if (href.includes("?"))
                return;

            let name = $(link).text().trim();

try {

    name = decodeURIComponent(name);

}

catch {

    // Leave the original text if it isn't valid URI encoding

}

            if (name === "Parent Directory")
                return;

            const cols = $(row).find("td");

            const modified =
                cols.eq(2).text().trim();

            const size =
                cols.eq(3).text().trim();

            const url =
                resolveURL(baseURL, href);

            if (!url)
                return;

            const type = classify(href);
           

if (type === "ignore")
    return;

if (type === "video") {
    name = decodeURIComponent(
        href.split("/").pop()
    );
}

            if (type === "ignore")
                return;

            entries.push({

                type,

                name,

                href,

                url,

                path: new URL(url).pathname,

                modified,

                size

            });

        });

    }

    // -------------------------------------------------
    // Apache AutoIndex (<pre> layout)
    // -------------------------------------------------

    else {

        $("pre a").each((_, link) => {

            const href = $(link).attr("href");

            if (!href)
                return;

            if (href === "../")
                return;

            if (href.includes("?"))
                return;

            
               let name = $(link).text().trim();

try {

    name = decodeURIComponent(name);

}

catch {

    // Leave the original text if it isn't valid URI encoding

}

            if (name === "Parent Directory")
                return;

            const url =
                resolveURL(baseURL, href);

            if (!url)
                return;

            const type = classify(href);
            if (type === "video") {
    try {
        name = decodeURIComponent(
            href.split("/").pop()
        );
    } catch {
        name = href.split("/").pop();
    }
}

            if (type === "ignore")
                return;

            entries.push({

                type,

                name,

                href,

                url,

                path: new URL(url).pathname,

                modified: "",

                size: ""

            });

        });

    }
console.log(
    baseURL,
    entries.length
);
    return entries;

}

async function crawl(url) {

    const html = await fetchDirectory(url);

    const entries = parseDirectory(html, url);

    console.log("[CRAWL]", url);
    console.log("[ENTRIES]", entries.length);

    if (entries.length) {
        console.log(entries.slice(0, 10));
    }

    return entries;

}

async function crawlQueue(
    root,
    visitor,
    progress = null
) {

    const queue = [root];

const visited = new Set();

let pointer = 0;
console.log(
    "[VISITING]",
    "Pointer:",
    pointer,
    "Queue:",
    queue.length
);
while (pointer < queue.length) {

    const current =
        queue[pointer++];
const currentUrl =
    typeof current === "string"
        ? current
        : current.url;

if (visited.has(currentUrl))
    continue;

        visited.add(
    typeof current === "string"
        ? current
        : current.url
);

        if (progress) {

    await progress({

        current,

        queue,

        pointer,

        visited

    });

}

        let entries = null;

for (let i = 0; i < 3; i++) {

    try {

        entries = await crawl(
    typeof current === "string"
        ? current
        : current.url
);

        break;

    }

    catch (e) {

    if (i === 2) {

        console.error(
            "[CTG] Failed:",
            currentUrl
        );

        console.error(
            e
        );

    }

}

}

if (!entries)
    continue;

for (const entry of entries) {

    try {

        await visitor(entry, {
            queue: queue.length,
            visited: visited.size,
            current
        });

    } catch (e) {

        console.error(
            "[CTG] Visitor Error:",
            entry.url
        );

        console.error(e);
    }
console.log(
    entry.name,
    entry.type
);
    if (entry.type === "directory") {
queue.push(entry.url);
    }
    
    console.log(
    "[QUEUE]",
    queue.length,
    entry.url
);
}        }

    }



module.exports = {

    crawl,

    crawlQueue,

    parseDirectory,

    fetchDirectory

};