const indexer = require("./indexer");

(async () => {

    await indexer.build();

    console.log(indexer.getStats());

    console.log(indexer.getIndex());

})();