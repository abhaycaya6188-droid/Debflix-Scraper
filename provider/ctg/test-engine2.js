const engine2 = require("./engine2");

engine2.loadIndex();

console.log(
    engine2.search({
        title: "Primitive War",
        type: "movie"
    })
);

console.log(
    engine2.search({
        title: "The Mentalist",
        type: "tv",
        season: 7,
        episode: 1
    })
);

console.log(
    engine2.search({
        title: "MTV Roadies",
        type: "tv",
        season: 20,
        episode: 1
    })
);

console.log(
    engine2.search({
        title: "Shark Tank India",
        type: "tv",
        season: 4,
        episode: 1
    })
);