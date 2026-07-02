const db = require("./database");

function saveProgress(data) {

    const stmt = db.prepare(`
INSERT INTO progress (

    userId,
    tmdbId,
    type,
    season,
    episode,
    title,
    poster,
    provider,
    sourceUrl,
    position,
    duration,
    updatedAt

)

VALUES (

    @userId,
    @tmdbId,
    @type,
    @season,
    @episode,
    @title,
    @poster,
    @provider,
    @sourceUrl,
    @position,
    @duration,
    @updatedAt

)

ON CONFLICT(
    userId,
    tmdbId,
    type,
    season,
    episode
)

DO UPDATE SET

    provider = excluded.provider,
    sourceUrl = excluded.sourceUrl,
    position = excluded.position,
    duration = excluded.duration,
    updatedAt = excluded.updatedAt,
    title = excluded.title,
    poster = excluded.poster

`);    stmt.run({

    userId: data.userId || "default",

    ...data,

    updatedAt: Date.now()

});

}

module.exports = {

    saveProgress

};