console.log("TEST START");

const browser = require("./cinecloud-browser");

(async () => {

    console.log("CALLING RESOLVER");

    const result = await browser.resolve(
        "https://new5.cinecloud.site/x/0b6d0178"
    );

    console.log("RESULT:");
    console.log(result);

})().catch(console.error);