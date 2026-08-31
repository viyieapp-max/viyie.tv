const handler = require('./src/lib/vidlink/index.cjs');
const http = require('http');

const server = http.createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.end(err.message);
  }
});
server.listen(4000, () => {
  console.log('Listening');
});
