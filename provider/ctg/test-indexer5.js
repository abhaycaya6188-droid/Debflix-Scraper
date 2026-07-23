const indexer = require("./indexer5");

(async () => {

    console.log("==================================");
    console.log("CTG SERVER 5 INDEX TEST");
    console.log("==================================");
    console.log("");

    await indexer.build();

    console.log("Build completed successfully.");
    console.log(indexer.getStats());

})();