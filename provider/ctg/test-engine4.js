const engine = require("./engine4");

engine.loadIndex();

console.log("");
console.log("========== CTG ENGINE 4 ==========");
console.log("");

console.log("Total Entries :", engine.getIndex().length);
console.log("Movie Titles  :", engine.getMovieMap().size);
console.log("TV Episodes   :", engine.getTvMap().size);