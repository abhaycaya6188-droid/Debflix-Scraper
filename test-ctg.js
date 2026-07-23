const engine = require("./provider/ctg/engine");

engine.loadIndex();

const results = engine.search({

    title: "Breaking Bad",
    type: "tv",
    season: 1,
    episode: 1

});

console.log(results);