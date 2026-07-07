const fs = require("fs/promises");

const HOME = "https://cinemm.com/";
const SEARCH_URL = "https://cinemm.com/";

const INIT_ACTION =
    "6077a1a88313137459881a82cca9e76114af8993f6";

const SEARCH_ACTION =
    "6018fac11e9b775fd3a7f877cdc4ab1b312b8e978c";

const MOVIE_ACTION =
    "401dd7f7ed7453fdfdcc55d28458444ecec9e4cc8d";

const ROUTER_STATE =
    "%5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D";

const HEADERS = {

    "Accept": "text/x-component",

    "Content-Type": "text/plain;charset=UTF-8",

    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",

    "sec-ch-ua":
        "\"Chromium\";v=\"138\", \"Not)A;Brand\";v=\"24\"",

    "sec-ch-ua-mobile": "?0",

    "sec-ch-ua-platform": "\"Windows\""

};

const COOKIE_JAR = {};

function saveCookies(setCookie) {

    if (!setCookie)
        return;

    const cookies = setCookie.split(",");

    for (const cookie of cookies) {

        const first =
            cookie.trim().split(";")[0];

        const idx =
            first.indexOf("=");

        if (idx === -1)
            continue;

        const key =
            first.substring(0, idx);

        const value =
            first.substring(idx + 1);

        COOKIE_JAR[key] = value;

    }

}

function cookieHeader() {

    return Object
        .entries(COOKIE_JAR)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

}

async function post(url, action, referer, body) {

    const headers = {

        ...HEADERS,

        "Next-Action": action,

        "Next-Router-State-Tree":
            ROUTER_STATE,

        Referer: referer

    };

    // Don't send cookies when creating a new session
if (action !== INIT_ACTION) {

    const cookie =
        cookieHeader();

    if (cookie)
        headers.Cookie = cookie;

}

    const res = await fetch(url, {

        method: "POST",

        headers,

        body: JSON.stringify(body)

    });

    saveCookies(
        res.headers.get("set-cookie")
    );

    return await res.text();

}

async function initSession() {

    // Force a completely fresh session
    delete COOKIE_JAR.user_uuid;
    delete COOKIE_JAR.client_ip;

    console.log("COOKIE JAR CLEARED");

    const text = await post(

        HOME,

        INIT_ACTION,

        HOME,

        [
            "d5b45f60a96915ea0e72823ca3dbb632",
            null
        ]

    );

    const uuid =
        /"uuid":"([^"]+)"/
            .exec(text)?.[1];

    const remaining =
        Number(
            /"remaining":(\d+)/
                .exec(text)?.[1] || 0
        );

    console.log("NEW UUID :", uuid);
console.log("REMAINING:", remaining);
console.log("COOKIE JAR:", COOKIE_JAR);

return {

    uuid,

    remaining

};

}

function parseSearch(text) {

    const match =
        text.match(
            /1:(\[[\s\S]*?\])(?:\n|$)/
        );

    if (!match)
        return [];

    try {

        return JSON.parse(
            match[1]
        );

    } catch (e) {

        console.log(
            "[CINEMM] Search parse failed:",
            e.message
        );

        return [];

    }

}

async function searchMovie(
    title,
    type = "movie"
) {

    const url =
        `https://cinemm.com/?search=${encodeURIComponent(title)}&type=${type}`;

    const text = await post(

        url,

        SEARCH_ACTION,

        url,

        [
            title,
            type
        ]

    );

    await fs.writeFile(
        "cinemm-search.txt",
        text
    );

    const movies =
        parseSearch(text);

    return movies;

}

function pickMovie(
    movies,
    title,
    year
) {

    if (!movies.length)
        return null;

    const exact =
        movies.find(m =>
            m.name.toLowerCase() ===
            title.toLowerCase() &&
            Number(m.year) === Number(year)
        );

    if (exact)
        return exact;

    const sameTitle =
        movies.find(m =>
            m.name.toLowerCase() ===
            title.toLowerCase()
        );

    if (sameTitle)
        return sameTitle;

    return movies[0];

}

async function getMovieServers(movieId) {

    const url =
        `${HOME}?id=${movieId}`;

    const text = await post(

        url,

        MOVIE_ACTION,

        url,

        [
            Number(movieId)
        ]

    );

    console.log("========== RAW MOVIE RESPONSE ==========");
console.log(text);
console.log("========================================");

    await fs.writeFile(
        "cinemm-movie.txt",
        text
    );

    const match =
        text.match(
            /"servers":(\[[\s\S]*?\]),"remaining"/
        );

    if (!match)
        return [];

    try {

        return JSON.parse(match[1]);

    } catch (e) {

        console.log(
            "[CINEMM] Failed parsing servers:",
            e.message
        );

        return [];

    }

}

function normalize(servers) {

    const seen =
        new Set();

    return servers

        .filter(s =>
            s.name.includes("Stream")
        )

        .filter(s => {

            if (seen.has(s.url))
                return false;

            seen.add(s.url);

            return true;

        })

        .map(s => {

            let quality = "";

if (/4K|2160/i.test(s.name))
    quality = "2160p";

else if (/1080/i.test(s.name))
    quality = "1080p";

else if (/720/i.test(s.name))
    quality = "720p";

else if (/480/i.test(s.name))
    quality = "480p";

            const source = `${s.name} ${s.url}`;

let codec = "";

if (/HEVC|H\.265/i.test(source))
    codec = "HEVC";

else if (/AV1/i.test(source))
    codec = "AV1";

else if (/H\.264|AVC/i.test(source))
    codec = "H264";

            const mirror =
    s.name.startsWith("Tube")
        ? "Tube"
        : s.name.startsWith("Server")
        ? "Server"
        : s.name.startsWith("Cloud")
        ? "Cloud"
        : "Unknown";

return {

    provider: "CineMM",

    mirror,

    title: s.name,

    quality,

    codec,

    size: s.size,

    url: s.url,

    type: "stream"

};

        });

}

async function getStreams({

    title,

    year,

    type = "movie"

}) {

    if (!COOKIE_JAR.user_uuid) {

    const session = await initSession();

    if (!session.uuid) {

        throw new Error(
            "Failed to initialize CineMM session"
        );

    }

}
const movies =
    await searchMovie(
        title,
        type
    );
console.log("[CINEMM] Movies Found:");
console.log(movies);
const movie =
    pickMovie(
        movies,
        title,
        year
    );
console.log("[CINEMM] Picked Movie:");
console.log(movie);
if (!movie) {

    return [];

}

const servers =
    await getMovieServers(
        movie.id
    );
console.log("[CINEMM] Servers Found:");
console.log(servers.length);


if (!servers.length) {

    return [];

}

return normalize(
    servers
);

}

module.exports = {

    getStreams

};

if (require.main === module) {

    (async () => {

        const tests = [

            {
                title: "Interstellar",
                year: 2014,
                type: "movie"
            },

            {
                title: "Oppenheimer",
                year: 2023,
                type: "movie"
            },

            {
                title: "Avatar",
                year: 2009,
                type: "movie"
            },

            {
                title: "Obsession",
                year: 2026,
                type: "movie"
            },

            {
                title: "John Wick",
                year: 2014,
                type: "movie"
            }

        ];

        for (const test of tests) {

            console.log("\n================================");
            console.log(test.title);
            console.log("================================");

            const streams =
                await getStreams(test);

            console.log(
                "Streams:",
                streams.length
            );

            if (streams.length) {

                console.table(

                    streams.map(s => ({

                        Quality: s.quality,

                        Size: s.size,

                        Codec: s.codec,

                        Mirror: s.mirror

                    }))

                );

            }

        }

    })();


}