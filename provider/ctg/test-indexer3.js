const indexer = require("./indexer3");

(async () => {
    try {
        console.log("==================================");
        console.log("CTG SERVER 3 INDEX TEST");
        console.log("==================================");
        console.log("");

        await indexer.build();

        console.log("");
        console.log("Build completed successfully.");
        console.log(indexer.getStats());

    } catch (err) {
        console.error(err);
    }
})();