const indexer = require("./indexer4");

(async () => {

    console.log("==================================");
    console.log("CTG SERVER 4 INDEX TEST");
    console.log("==================================");
    console.log("");

    await indexer.build();

    console.log("Build completed successfully.");
    console.log(indexer.getStats());

})();