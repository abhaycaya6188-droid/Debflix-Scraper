const crawler = require("./crawler");

async function visit(entry) {
    if (entry.name.includes("ARJUN")) {
        console.log("VISIT", entry.name);
    }
}

(async () => {

    await crawler.crawlQueue(
        {
            name: "test",
            url: "https://dl.ctgfun.com/disk2/South%20Indian%20Movies/ARJUN%20SURAVARAM%20%282019%29%20Telugu%20TRUE%20HDRip%20-%20720p%20-%20x264%20-%20AAC%20-%20ESub%20%5BDDN%5D/"
        },
        visit
    );

})();