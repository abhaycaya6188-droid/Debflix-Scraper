const crawler = require("./crawler");

(async () => {

    try {

        const items = await crawler.crawl(
            "https://movie.ctgfun.com/disk1/English%20Movies/2021/Marcel.the.Shell.with.Shoes.On.2021.PROPER.1080p.WEBRip.x264%20%5BDDN%5D/"
        );

        console.log("Entries:", items.length);

        console.table(items);

    }

    catch (err) {

        console.error(err);

    }

})();