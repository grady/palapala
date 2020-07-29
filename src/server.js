let express = require('express');
let session = require('express-session');
let MongoStore = require('connect-mongo')(session);
let path = require('path');
let WebSocket = require('ws');
let ShareDb = require('sharedb');
let shareDbAccess = require('sharedb-access');
let WebSocketJSONStream = require('websocket-json-stream');
let shortid = require('shortid');
let MongoClient = require('mongodb');

MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, (err, dbase) => {
  if (err) throw err;
  const sessionParser = session({
    secret: 'palapala',
    name: 'palapala',
    cookie: { maxAge: 31536000000 },
    saveUninitialized: true,
    resave: true,
    store: new MongoStore({ client: dbase }),
  });
  sharedbMongo = require('sharedb-mongo')({ mongo: (cb) => { cb(err, dbase) } });
  const sharedb = new ShareDb({ db: sharedbMongo });
  sharedb.addProjection('document_list', 'palapala', {id: true});
  const app = express();
  app.use(sessionParser);

  app.use("/:id/", express.static(path.join(__dirname, "..")));
  app.use("/", (req, res) => res.redirect("/" + shortid.generate()));

  const server = app.listen(process.env.PORT || 8000);
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, sock, head) => {
    sessionParser(req, {}, () => { });
    wss.handleUpgrade(req, sock, head, (ws) => { wss.emit('connection', ws, req) });
  });

  wss.on("connection", (ws, req) => {
    console.log("connection accepted", req.url, req.sessionID);
    let stream = new WebSocketJSONStream(ws);
    sharedb.listen(stream, req);
  });

  sharedb.use('connect', (ctx, next) => {
    ctx.agent.connectSession = { userID: ctx.req.sessionID };
    next();
  });
  sharedb.use('apply', (ctx, next) => {
    if (ctx.op.create) ctx.op.create.data.owner = ctx.agent.connectSession.userID;
    next();
  });
  sharedb.use('reply', (ctx, next) => {
    if (ctx.reply && ctx.reply.data && ctx.reply.data.data) {
      ctx.reply.data.data.owner = ctx.reply.data.data.owner === ctx.agent.connectSession.userID;
    }
    next();
  });
  sharedb.use('query', (ctx, next) => {
    ctx.query.owner = ctx.agent.connectSession.userID;
    next();
  });


  shareDbAccess(sharedb);
  sharedb.allowCreate('palapala', async (id, doc, sess) => true);
  sharedb.allowRead('palapala', async (id, doc, sess) => true);
  sharedb.allowUpdate('palapala', async (id, oldDoc, newDoc, ops, sess) => oldDoc.edit || sess.userID === oldDoc.owner);
  sharedb.allowDelete('palapala', async (id, doc, sess) => false);



  function close(obj) {
    return new Promise((resolve, reject) => {
      obj.close((err, res) => { if (err) reject(err); else resolve(res); })
    });
  }

  async function shutdown(msg) {
    console.log(msg);
    try {
      console.log('Shutdown web socket server.');
      await close(wss);
      console.log('Closing sharedb connection.')
      await close(sharedb);
      console.log('Closing express server.');
      await close(server);
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
    console.log('Shutdown complete.');
    process.exit(0);
  }

  process.on('SIGUSR2', () => { shutdown("SIGUSR2 recieved"); });
  process.on('SIGINT', () => { shutdown("SIGINT recieved."); });

});

