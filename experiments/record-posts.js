const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

const OUT = path.join(__dirname, "posts");

(async () => {

    await fs.mkdir(OUT, { recursive: true });

    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    let count = 0;

    page.on("response", async (response) => {

        const request = response.request();

        if (request.method() !== "POST")
            return;

        const id = (++count).toString().padStart(3, "0");

        console.log("\n===========================");
        console.log(id, request.method(), request.url());
        console.log("===========================\n");

        let responseBody = "";

        try {
            responseBody = await response.text();
        } catch (e) {
            responseBody = "<<unable to read response>>";
        }

        const data = {
            url: request.url(),
            method: request.method(),

            requestHeaders: request.headers(),

            postData: request.postData(),

            responseStatus: response.status(),

            responseHeaders: response.headers(),

            responseBody
        };

        await fs.writeFile(
            path.join(OUT, `${id}.json`),
            JSON.stringify(data, null, 2)
        );

        console.log("Saved", id);

    });

    await page.goto("https://cinemm.com");

    console.log(`
==========================================

1. Search: obsession

2. Click Obsession

3. Wait until Tube 1 / Tube 2 appears

4. STOP

5. Close browser

==========================================
`);

    await page.pause();

    await browser.close();

})();