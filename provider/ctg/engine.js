/* ============================================================
   CTG Engine
============================================================ */

const fs = require("fs");
const path = require("path");

const matcher = require("./matcher");

const INDEX_FILE =
    path.join(
        __dirname,
        "cache",
        "index.json"
    );

let index = [];
let loaded = false;

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

    loaded = true;

    console.log(
        `[CTG] Loaded ${index.length} entries`
    );

}

function search(query) {

    if (!loaded)
        loadIndex();

    return matcher.search(
        index,
        query
    );

}

module.exports = {

    loadIndex,

    search

};