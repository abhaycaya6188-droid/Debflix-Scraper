/* ============================================================
   CTG Engine #3 Test
============================================================ */

const engine = require("./engine3");

engine.loadIndex();

console.log("");
console.log("========== CTG ENGINE 3 ==========");
console.log("");

console.log("Total Entries :", engine.getIndex().length);
console.log("Movie Titles  :", engine.getMovieMap().size);
console.log("TV Episodes   :", engine.getTvMap().size);

console.log("");
console.log("==================================");
console.log("");

// Test Movie
console.log("Searching Avatar...");

let results = engine.search({
    title: "Avatar",
    type: "movie"
});

console.log(results.slice(0, 3));

console.log("");

// Test TV
console.log("Searching Breaking Bad S01E01...");

results = engine.search({
    title: "Breaking Bad",
    type: "tv",
    season: 1,
    episode: 1
});

console.log(results.slice(0, 3));