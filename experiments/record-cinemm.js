const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

const OUT = path.join(__dirname, "network");

(async () => {

    await fs.mkdir(OUT, { recursive: true });

    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    let count = 0;

    page.on("response", async (response) => {

        try {

            const request = response.request();

            const url = request.url();

            const status = response.status();

            const type = response.headers()["content-type"] || "";

            console.log(status, url);

            let body = "";

            try {
                body = await response.text();
            } catch {}

            const id = (++count).toString().padStart(4, "0");

            await fs.writeFile(
                path.join(OUT, `${id}.txt`),
                body
            );

            await fs.writeFile(
                path.join(OUT, `${id}.json`),
                JSON.stringify({
                    url,
                    method: request.method(),
                    status,
                    headers: response.headers()
                }, null, 2)
            );

        } catch (e) {
            console.log(e.message);
        }

    });

    await page.goto("https://cinemm.com");

    console.log("\n==============================");
    console.log("Type 'obsession'");
    console.log("Click the movie");
    console.log("DO NOT close browser");
    console.log("==============================\n");

    await page.pause();

})();