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
    console.log("[CINECLOUD GET]", {
    status: getRes.status,
    url: getRes.url,
    contentType: getRes.headers.get("content-type"),
    length: html.length,
    title:
        html.match(
            /<title[^>]*>([^<]*)<\/title>/i
        )?.[1] || "NO TITLE"
});


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

    let getRes;

try {
    getRes = await fetch(
        downloadUrl.replace("/w/", "/d/"),
        {
            headers: HEADERS
        }
    );
} catch (e) {
    console.error("❌ FAILED: GET /d/");
    throw e;
}

    const html = await getRes.text();

    const cookies = getRes.headers.getSetCookie();

    const cookieHeader = cookies
        .map(x => x.split(";")[0])
        .join("; ");

    const csrf =
    html.match(
        /<meta[^>]+name=["']X-CSRF-TOKEN["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']X-CSRF-TOKEN["']/i
    )?.[1];

    if (!csrf) {
        return {
            success: false,
            error: "No CSRF"
        };
    }

    console.log("[CINECLOUD] Starting generation...");

    // ---------- STEP 2 : START GENERATION ----------

    try {

    const postRes = await fetch(downloadUrl, {
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

console.log("POST STATUS:", postRes.status);

const postBody = await postRes.text();

console.log(postBody.substring(0, 500));

} catch (e) {
    console.error("❌ FAILED: POST /w/");
    throw e;
}
    // ---------- STEP 3 : POLL ----------

    for (let i = 1; i <= 30; i++) {

        

        await new Promise(r => setTimeout(r, 2000));

        let res;

try {

    res = await fetch(downloadUrl, {
        headers: {
            ...HEADERS,
            Cookie: cookieHeader
        }
    });

} catch (e) {
    console.error(`❌ FAILED: POLL ${i}`);
    throw e;
}
        const page = await res.text();

        if (i === 1 || i === 10 || i === 20 || i === 30) {

    require("fs").writeFileSync(
        `poll-${i}.html`,
        page
    );

   

}

const googleLinks = [
    ...page.matchAll(/https:\/\/video-downloads\.googleusercontent\.com[^"' ]+/g)
].map(m => m[0]);

const uniqueLinks = [...new Set(googleLinks)];

console.log("Google links found:", googleLinks.length);
console.log("Unique Google links:", uniqueLinks.length);

uniqueLinks.forEach((link, i) => {
    console.log(`Link ${i + 1}: ${link}`);
});

googleLinks.forEach((link, i) => {
    console.log(`${i + 1}: ${link.substring(0, 120)}...`);
});

        const match = page.match(
    /href="(https:\/\/video-downloads\.googleusercontent\.com[^"]+)"/i
);

        if (match) {

    require("fs").writeFileSync(
        "cinecloud-success.html",
        page
    );

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