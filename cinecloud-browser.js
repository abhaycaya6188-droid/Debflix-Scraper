
console.log("BROWSER MODULE LOADED");

const { chromium } = require("playwright");

async function resolve(downloadUrl) {

    console.log("[BROWSER]", downloadUrl);
    console.log("ENTERED RESOLVE");

    console.log(downloadUrl);

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({

        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"

    });



    try {

        await page.goto(downloadUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("Waiting 5 seconds...");

await page.waitForTimeout(5000);

const iframes = await page.locator("iframe").evaluateAll(nodes =>
    nodes.map(n => ({
        src: n.getAttribute("src"),
        width: n.getAttribute("width"),
        height: n.getAttribute("height"),
        hidden: n.hidden
    }))
);

console.log(iframes);


        const iframe =
    iframes.find(i => i.src)?.src;;

        console.log("[IFRAME]");
        console.log(iframe);

        const parsed = new URL(iframe);

console.log("STREAM:");
console.log(
    decodeURIComponent(
        parsed.searchParams.get("id")
    )
);

console.log("SUBTITLE:");
console.log(
    decodeURIComponent(
        parsed.searchParams.get("sub[0]")
    )
);

        await browser.close();

        return {
    success: true,
    stream: decodeURIComponent(
        parsed.searchParams.get("id")
    ),
    subtitles: decodeURIComponent(
        parsed.searchParams.get("sub[0]")
    ),
    iframe
};

    } catch (e) {

        console.error(e);

        await browser.close();

        return {
            success: false,
            error: e.message
        };

    }

}

module.exports = {
    resolve
};
