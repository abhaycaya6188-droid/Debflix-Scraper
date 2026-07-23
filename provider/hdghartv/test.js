const {
    getHDGharTVStreams,
} = require("./index");

async function run() {
    const tests = [
        {
            name: "Game of Thrones S01E01",
            input: {
                id: "1399",
                tmdbId: "1399",
                type: "tv",
                title: "Game of Thrones",
                year: 2011,
                season: 1,
                episode: 1,
            },
        },
        {
            name: "The Dark Knight",
            input: {
                id: "155",
                tmdbId: "155",
                type: "movie",
                title: "The Dark Knight",
                year: 2008,
            },
        },
    ];

    for (const test of tests) {
        console.log(
            `\n===== ${test.name} =====`
        );

        try {
            const result =
                await getHDGharTVStreams(
                    test.input
                );

            console.log(
                JSON.stringify(result, null, 2)
            );
        } catch (error) {
            console.error(
                error instanceof Error
                    ? error.stack
                    : error
            );
        }
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});