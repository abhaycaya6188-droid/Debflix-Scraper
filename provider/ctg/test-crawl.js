const crawler = require("./crawler");
const parser = require("./parser");

(async () => {

    const url =
        "https://dl.ctgfun.com/disk2/South%20Indian%20Movies/ARJUN%20SURAVARAM%20%282019%29%20Telugu%20TRUE%20HDRip%20-%20720p%20-%20x264%20-%20AAC%20-%20ESub%20%5BDDN%5D/";

    const entries = await crawler.crawl(url);

    for (const entry of entries) {

        console.log(entry);

        const meta =
            parser.parse(entry.name, entry.path);

        console.log(meta);

        console.log(
            parser.validate(meta)
        );
    }

})();