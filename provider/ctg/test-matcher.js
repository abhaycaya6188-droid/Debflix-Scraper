const matcher = require("./matcher");

const index = [

    {

        title: "Avatar",

        year: 2009,

        quality: "1080p",

        codec: "H264"

    },

    {

        title: "Avatar",

        year: 2009,

        quality: "2160p",

        codec: "HEVC",

        hdr: true

    },

    {

        title: "Superman",

        year: 2025,

        quality: "2160p",

        codec: "HEVC"

    }

];

console.table(

    matcher.search(index, {

        title: "Avatar",

        year: 2009

    })

);