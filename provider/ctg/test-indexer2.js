const indexer = require("./indexer2");

(async () => {

    await indexer.build();

    console.log(indexer.getStats());

    console.log(indexer.getIndex());

})();