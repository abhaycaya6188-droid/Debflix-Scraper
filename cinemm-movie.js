const MOVIE_ACTION =
    "401dd7f7ed7453fdfdcc55d28458444ecec9e4cc8d";

const BASE =
    "https://cinemm.com/?search=obsession&type=movie";

async function main() {

    console.log("==================================");
    console.log(" CineMM Movie Test");
    console.log("==================================\n");

    const res = await fetch(BASE, {

        method: "POST",

        headers: {

            "Accept": "text/x-component",

            "Content-Type": "text/plain;charset=UTF-8",

            "Next-Action": MOVIE_ACTION,

            "Next-Router-State-Tree":
                "%5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",

            "Referer":
                "https://cinemm.com/?search=obsession&type=movie",

            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",

            "sec-ch-ua":
                "\"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",

            "sec-ch-ua-mobile": "?0",

            "sec-ch-ua-platform": "\"macOS\""

        },

        body: JSON.stringify([
            24489
        ])

    });

    console.log("Status :", res.status);

    console.log(
        "Type   :",
        res.headers.get("content-type")
    );

    const text = await res.text();

    await require("fs/promises").writeFile(
        "movie-response.txt",
        text
    );

    console.log("Saved movie-response.txt");

    console.log(
        "\nLength :",
        text.length
    );

    console.log("\n=========================");
    console.log("FIRST 2500 CHARS");
    console.log("=========================\n");

    console.log(
        text.substring(0,2500)
    );

    console.log("\n=========================");

    console.log(
        "\nContains servers :",
        text.includes("servers")
    );

    console.log(
        "Contains Tube :",
        text.includes("Tube")
    );

    console.log(
        "Contains stream.cmreel :",
        text.includes("stream.cmreel")
    );

    console.log(
        "Contains Obsession :",
        text.includes("Obsession")
    );

}

main().catch(console.error);