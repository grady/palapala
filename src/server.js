let express = require('express');
let session = require('express-session');
let MongoStore = require('connect-mongo')(session);
let path = require('path');
let WebSocket = require('ws');
let ShareDb = require('sharedb');
let shareDbAccess = require('sharedb-access');
let WebSocketJSONStream = require('websocket-json-stream');
let shortid = require('shortid');
const { escapeSelector } = require('jquery');

const app = express();
let sessionParser = session({
  secret: 'palapala',
  name: 'palapala',
  cookie: { maxAge: 31536000000 },
  saveUninitialized: true,
  resave: true,
  store: new MongoStore({ url: process.env.MONGO_URL }),
});
app.use(sessionParser);
//app.use()
// app.use((req, res, next)=>{console.log(req.session);next();});
app.use("/:id/", express.static(path.join(__dirname, "..")));
app.use("/", (req, res) => res.redirect("/" + shortid.generate()));

const server = app.listen(process.env.PORT || 8000);
const wss = new WebSocket.Server({
  noServer: true,
  //server: server, 
  // verifyClient: (info, done) => {
  //   sessionParser(info.req, {}, () => { done(info.req.sessionID); });
  // },
});
server.on('upgrade', (req, sock, head) => {
  sessionParser(req, {}, () => {});
  wss.handleUpgrade(req, sock, head, (ws)=>{wss.emit('connection', ws, req)});
});

// let db;
// if (process.env.MONGO_URL) {
//   console.log("Connecting to Mongodb...");
//   const mongodb = require("mongodb");
//   const sharedbMongo = require("sharedb-mongo");
//   db = sharedbMongo({ mongo: cb => mongodb.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, cb) });
// }
// else {
//   db = ShareDb.MemoryDB();
// }
const sharedb = new ShareDb({db: process.env.MONGO_URL ? 
  require('sharedb-mongo')(process.env.MONGO_URL, {mongoOptions:{ useUnifiedTopology: true}}) : 
  ShareDb.MemoryDB()
});

wss.on("connection", (ws, req) => {
  console.log("connection accepted", req.url, req.sessionID);
  let stream = new WebSocketJSONStream(ws);
  sharedb.listen(stream, req);
});

sharedb.use('connect', (ctx, next) => {
  //console.log(ctx.req.sessionID);
  ctx.agent.connectSession = { userID: ctx.req.sessionID };
  next();
});
sharedb.use('apply', (ctx, next) => {
  if (ctx.op.create) ctx.op.create.data.owner = ctx.agent.connectSession.userID;
  //console.log("apply op:", ctx.op);
  next();
});
sharedb.use('reply', (ctx, next) => {
  //console.log("request", ctx.request);
  //console.log("reply", ctx.reply);
  if (ctx.reply && ctx.reply.data && ctx.reply.data.data) {
    ctx.reply.data.data.owner = ctx.reply.data.data.owner === ctx.agent.connectSession.userID;//userID;
  }
  next();
});

shareDbAccess(sharedb);
sharedb.allowCreate('palapala', async (id, doc, sess) => true);
sharedb.allowRead('palapala', async (id, doc, sess) => true);
sharedb.allowUpdate('palapala', async (id, oldDoc, newDoc, ops, sess) => oldDoc.edit || sess.userID === oldDoc.owner);
sharedb.allowDelete('palapala', async (id, doc, sess) => false);

function close() {
  wss.close(() => {
    console.log("wss closed.");
    sharedb.close(() => {
      console.log("sharedb closed.");
      server.close(() => {
        console.log("server closed.");
        process.exit(0);
      });
    });
  });
}

process.on('SIGUSR2', () => {
  console.log("SIGUSR2 recieved");
  close();
});
process.on('SIGINT', () => {
  console.log("SIGINT recieved.");
  close();
});