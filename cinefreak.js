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

    const $ = cheerio.load(html);

    const links = [];

    $("a[href*='generate.php']").each((i, el) => {

    links.push({
        text: $(el).text().trim(),
        href: $(el).attr("href")
    });

});

    const decoded = links.map(item => {

    const href = item.href.startsWith("http")
        ? item.href
        : BASE + item.href;

    try {

        const id = new URL(href)
            .searchParams
            .get("id");

        const decoded = Buffer
    .from(id, "base64")
    .toString("utf8")
    .replace(/newgo32$/i, "");

return {
    text: item.text,
    generate: href,
    decoded
};

    } catch {

        return {
            text: item.text,
            generate: href,
            decoded: null
        };

    }

});
return {
    count: decoded.length,
    links: decoded
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
    console.log("========== NEW RESOLVE ==========");

    const pageResult = await page(slug);

    const download =
        pageResult.links.find(
            x => x.text === "Download Links"
        );

    if (!download) {

        return {
            success: false,
            error: "Download Links not found"
        };

    }

    console.log("[DOWNLOAD]", download.decoded);

    const id =
        download.decoded.split("/").pop();

    const url =
        `https://new5.cinecloud.site/w/${id}`;

    console.log("[CINECLOUD]", url);

    return await cinecloud.generate(url);

}
module.exports = {
    search,
    page,
    resolve
};