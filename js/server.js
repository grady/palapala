const express = require('express');
const app = express();
const path = require('path')
const shortid = require('shortid');

app.use("/:id/", express.static(path.join(__dirname, "..")));
app.use("/:id/view/", express.static(path.join(__dirname, "..")));
app.use("/", (req, res) => {
    res.redirect("/" + shortid.generate());
});

const server = app.listen(process.env.PORT || 8000);
const ShareDB = require('sharedb');
let db;
if (process.env.MONGO_URL) {
    const mongodb = require("mongodb");
    db = require("sharedb-mongo")({
        mongo: cb => mongodb.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, cb)
    });
} else {
    db = ShareDB.MemoryDB();
}
const backend = new ShareDB({ db });

const WebSocket = require('ws');
const WebSocketJSONStream = require('websocket-json-stream');
const wss = new WebSocket.Server({ server: server });

wss.on("connection", function (ws, req) {
    console.log("connection acccepted: " + (req.headers['x-forwarded-for'] || req.connection.remoteAddress) + req.url);
    let stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
});