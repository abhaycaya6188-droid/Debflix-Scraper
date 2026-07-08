const INIT_ACTION =
    "6077a1a88313137459881a82cca9e76114af8993f6";

const BASE =
    "https://cinemm.com/";

async function main() {

    console.log("==================================");
    console.log(" CineMM Init Test");
    console.log("==================================\n");

    const res = await fetch(BASE, {

        method: "POST",

        headers: {

            "Accept": "text/x-component",

            "Content-Type": "text/plain;charset=UTF-8",

            "Next-Action": INIT_ACTION,

            "Next-Router-State-Tree":
                "%5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D",

            "Referer":
                "https://cinemm.com/",

            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",

            "sec-ch-ua":
                "\"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",

            "sec-ch-ua-mobile": "?0",

            "sec-ch-ua-platform": "\"macOS\""

        },

        body: JSON.stringify([
            "d5b45f60a96915ea0e72823ca3dbb632",
            null
        ])

    });

    console.log("Status :", res.status);
    console.log("Type   :", res.headers.get("content-type"));

    const text = await res.text();

    await require("fs/promises").writeFile(
        "init-response.txt",
        text
    );

    console.log("\nSaved init-response.txt");

    console.log("\nLength :", text.length);

    console.log("\n========== FIRST 2000 ==========\n");
    console.log(text.substring(0, 2000));

    console.log("\n========== SEARCH ==========\n");

    const words = [
        "uuid",
        "pin",
        "remaining",
        "usageCount",
        "initialUser",
        "bonusCredits",
        "client_uuid",
        "error"
    ];

    for (const word of words) {
        console.log(
            word.padEnd(15),
            text.includes(word)
        );
    }

}

main().catch(console.error);