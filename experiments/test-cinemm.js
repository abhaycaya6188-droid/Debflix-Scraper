const fs = require("fs/promises");

const BASE = "https://cinemm.com";

const PATHS = [
    "/api/search?q=obsession",
    "/api/search?query=obsession",
    "/api/search?search=obsession",
    "/api/movies/search?q=obsession",
    "/api/movie/search?q=obsession",
    "/api/content/search?q=obsession",
    "/api/search/movie?q=obsession",
    "/search?q=obsession",
    "/search?query=obsession",
    "/search?search=obsession",
    "/?search=obsession&type=movie"
];

async function test(path) {

    const url = BASE + path;

    console.log("\n====================================");
    console.log(url);

    try {

        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
                "Accept": "*/*"
            }
        });

        const text = await res.text();

        const type = res.headers.get("content-type") || "";

        console.log("Status :", res.status);
        console.log("Type   :", type);
        console.log("Length :", text.length);

        const found =
            text.includes("Obsession") ||
            text.includes("24489") ||
            text.includes("\"id\"") ||
            text.includes("\"name\"");

        console.log("Interesting :", found);

        if (found) {

            const file =
                path
                    .replace(/[\/?=&]/g, "_")
                    .replace(/^_/, "") + ".txt";

            await fs.writeFile(file, text);

            console.log("Saved :", file);

        }

        return {
            path,
            status: res.status,
            type,
            length: text.length,
            interesting: found
        };

    } catch (e) {

        console.log(e.message);

        return {
            path,
            error: e.message
        };
    }
}

(async () => {

    const results = [];

    for (const p of PATHS) {
        results.push(await test(p));
    }

    console.log("\n\n========== SUMMARY ==========\n");

    console.table(results);

})();