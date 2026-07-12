/* ============================================================
   CTG Engine #5
============================================================ */

const fs = require("fs");
const path = require("path");

const matcher = require("./matcher");

const INDEX_FILE = path.join(
    __dirname,
    "cache",
    "index5.json"
);

let index = [];
let movieMap = new Map();
let tvMap = new Map();
let loaded = false;

function buildMovieMap() {

    movieMap.clear();

    for (const entry of index) {

        const key =
            entry.normalizedTitle ||
            matcher.normalize(entry.title);

        entry.normalizedTitle = key;

        if (!movieMap.has(key)) {
            movieMap.set(key, []);
        }

        movieMap.get(key).push(entry);
    }

    console.log(
        `[CTG-5] Movie map built (${movieMap.size} titles)`
    );

}

function buildTvMap() {

    tvMap.clear();

    for (const entry of index) {

        if (entry.type !== "tv")
            continue;

        const title =
            entry.normalizedTitle ||
            matcher.normalize(entry.title);

        entry.normalizedTitle = title;

        const season =
            Number(entry.season) || 0;

        const episode =
            Number(entry.episode) || 0;

        const key =
            `${title}|${season}|${episode}`;

        if (!tvMap.has(key)) {

            tvMap.set(key, []);

        }

        tvMap.get(key).push(entry);

    }

    console.log(
        `[CTG-5] TV map built (${tvMap.size} episodes)`
    );

}

function loadIndex() {

    if (loaded)
        return;

    if (!fs.existsSync(INDEX_FILE)) {

        index = [];
        loaded = true;

        return;

    }

    index = JSON.parse(

        fs.readFileSync(
            INDEX_FILE,
            "utf8"
        )

    );

    console.log(
        `[CTG-5] Loaded ${index.length} entries`
    );

    buildMovieMap();
    buildTvMap();

    loaded = true;

}

function search(query) {

    if (!loaded)
        loadIndex();

    const start = Date.now();

    const results = matcher.search({

        index,

        movieMap,
        tvMap,

    }, query);

    if (process.env.CTG_DEBUG === "true") {

        console.log(
            `[CTG-5] "${query.title}" -> ${results.length} results in ${Date.now() - start} ms`
        );

    }

    return results;

}

module.exports = {

    loadIndex,

    search,

    getIndex() {

        return index;

    },

    getMovieMap() {

        return movieMap;

    },

    getTvMap() {

        return tvMap;

    }

};