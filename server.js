const http = require("http");
const handler = require("./api/index");

const port = process.env.PORT || 3000;

http.createServer((req, res) => {
  handler(req, res);
}).listen(port, () => {
  console.log(`Server running on port ${port}`);
});
