const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"
};

async function resolve(url) {

    console.log("[CINECLOUD]", url);

    const res = await fetch(url, {
        headers: HEADERS,
        redirect: "manual"
    });

    const html = await res.text();


const iframe =
    html.match(/<iframe[^>]+src="([^"]+)"/i);

if (!iframe) {

    const fs = require("fs");

fs.writeFileSync("interstellar.html", html);

return {
    success: false,
    error: "Iframe not found",
    saved: "interstellar.html"
};

}

const iframeUrl =
    iframe[1].replace(/&amp;/g, "&");

const r2 =
    decodeURIComponent(
        iframeUrl.match(/id=([^&]+)/)?.[1] || ""
    );

const subtitle =
    decodeURIComponent(
        iframeUrl.match(/sub%5B0%5D=([^&]+)/)?.[1] || ""
    );

return {

    success: true,

    stream: r2,

    subtitles: subtitle,

    iframe: iframeUrl

};

}



async function generate(downloadUrl) {

    // ---------- STEP 1 : GET page ----------

    const getRes = await fetch(
        downloadUrl.replace("/w/", "/d/"),
        {
            headers: HEADERS
        }
    );

    const html = await getRes.text();

    const cookies = getRes.headers.getSetCookie();

    const cookieHeader = cookies
        .map(x => x.split(";")[0])
        .join("; ");

    const csrf =
        html.match(
            /meta\s+name="X-CSRF-TOKEN"\s+content="([^"]+)"/i
        )?.[1];

    if (!csrf) {
        return {
            success: false,
            error: "No CSRF"
        };
    }

    console.log("[CINECLOUD] Starting generation...");

    // ---------- STEP 2 : START GENERATION ----------

    await fetch(downloadUrl, {

        method: "POST",

        headers: {
            ...HEADERS,
            Cookie: cookieHeader,
            Referer: downloadUrl.replace("/w/", "/d/"),
            Origin: "https://new5.cinecloud.site",
            "X-Requested-With": "XMLHttpRequest"
        },

        body: new URLSearchParams({
            csrf_test_name: csrf
        })

    });

    // ---------- STEP 3 : POLL ----------

    for (let i = 1; i <= 30; i++) {

        

        await new Promise(r => setTimeout(r, 2000));

        const res = await fetch(downloadUrl, {
            headers: {
                ...HEADERS,
                Cookie: cookieHeader
            }
        });

        const page = await res.text();

        if (i === 1 || i === 10 || i === 20 || i === 30) {

    require("fs").writeFileSync(
        `poll-${i}.html`,
        page
    );

   

}

        const match = page.match(
    /href="(https:\/\/video-downloads\.googleusercontent\.com[^"]+)"/i
);

        if (match) {

            console.log("[CINECLOUD] SUCCESS");

            return {
                success: true,
                stream: match[1]
            };

        }

    }

    return {
        success: false,
        error: "Timed out waiting for Instant Download"
    };

}
module.exports = {
    resolve,
    generate
};