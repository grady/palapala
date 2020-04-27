let ShareDB = require('sharedb');

const db = require("sharedb-mongo")(process.env.MONGO_URL);
const backend = new ShareDB({db});

let WebSocket = require('ws');
let wss = new WebSocket.Server({port: 8080});

let WebSocketJSONStream = require('websocket-json-stream');

wss.on("connection", function(ws, req){
    console.log("connection acccepted");
    let stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
});