const engine = require("./engine");

engine.loadIndex();

const results = engine.search({

    title: "Marcel the Shell with Shoes On",

    year: 2021

});

console.log(results);