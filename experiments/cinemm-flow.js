const fs = require("fs/promises");

const INIT_ACTION =
    "6077a1a88313137459881a82cca9e76114af8993f6";

const SEARCH_ACTION =
    "6018fac11e9b775fd3a7f877cdc4ab1b312b8e978c";

const MOVIE_ACTION =
    "401dd7f7ed7453fdfdcc55d28458444ecec9e4cc8d";

const SEARCH_URL =
    "https://cinemm.com/?search=obsession&type=movie";

const HOME_URL =
    "https://cinemm.com/";

const cookieJar = {};

const COMMON_HEADERS = {

    "Accept": "text/x-component",

    "Content-Type": "text/plain;charset=UTF-8",

    "Next-Router-State-Tree":
        "%5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",

    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",

    "sec-ch-ua":
        "\"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",

    "sec-ch-ua-mobile": "?0",

    "sec-ch-ua-platform": "\"macOS\""

};

function buildCookieHeader() {

    return Object.entries(cookieJar)
        .map(([k,v]) => `${k}=${v}`)
        .join("; ");

}

function saveCookies(setCookie) {

    if (!setCookie) return;

    const cookies = setCookie.split(",");

    for (const cookie of cookies) {

        const first = cookie.trim().split(";")[0];

        const idx = first.indexOf("=");

        if (idx === -1) continue;

        const name = first.substring(0, idx);

        const value = first.substring(idx + 1);

        cookieJar[name] = value;

    }

}

async function post(url, action, referer, body) {

    const headers = {

        ...COMMON_HEADERS,

        "Next-Action": action,

        "Referer": referer

    };

    const cookieHeader = buildCookieHeader();

    if (cookieHeader)
        headers.Cookie = cookieHeader;

    console.log("\nCOOKIE SENT:");
    console.log(cookieHeader || "(none)");

    const res = await fetch(url, {

        method: "POST",

        headers,

        body: JSON.stringify(body)

    });

    const setCookie = res.headers.get("set-cookie");

    console.log("\nSET COOKIE:");
    console.log(setCookie);

    saveCookies(setCookie);

    console.log("\nCOOKIE JAR:");
    console.log(cookieJar);

    return {

        headers: Object.fromEntries(res.headers.entries()),

        text: await res.text()

    };

}

(async () => {

    console.log("\n=================");
    console.log("INIT");
    console.log("=================");

    const init = await post(
        HOME_URL,
        INIT_ACTION,
        HOME_URL,
        [
            "d5b45f60a96915ea0e72823ca3dbb632",
            null
        ]
    );

    await fs.writeFile("flow-init.txt", init.text);

    const remaining =
        /"remaining":(\d+)/.exec(init.text)?.[1];

    console.log("Remaining:", remaining);

    console.log("\n=================");
    console.log("SEARCH");
    console.log("=================");

    const search = await post(
        SEARCH_URL,
        SEARCH_ACTION,
        SEARCH_URL,
        [
            "obsession",
            "movie"
        ]
    );

    await fs.writeFile("flow-search.txt", search.text);

    const id =
        /"id":(\d+)/.exec(search.text)?.[1];

    console.log("Movie ID:", id);

    console.log("\n=================");
    console.log("MOVIE");
    console.log("=================");

    const movie = await post(
        SEARCH_URL,
        MOVIE_ACTION,
        SEARCH_URL,
        [
            Number(id)
        ]
    );

    await fs.writeFile("flow-movie.txt", movie.text);

    console.log(
        "\nContains QUOTA:",
        movie.text.includes("QUOTA_EXCEEDED")
    );

    console.log(
        "Contains stream.cmreel:",
        movie.text.includes("stream.cmreel")
    );

    console.log(
        "Contains Tube:",
        movie.text.includes("Tube")
    );

})();