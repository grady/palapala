/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/
require('dotenv').config();
let express = require('express');
let session = require('express-session');
let MongoStore = require('connect-mongo')(session);
let path = require('path');
let WebSocket = require('ws');
let ShareDb = require('sharedb');
let sharedbMongo = require('sharedb-mongo');
let shareDbAccess = require('sharedb-access');
let WebSocketJSONStream = require('websocket-json-stream');
let shortid = require('shortid');
let MongoClient = require('mongodb');
let passport, GoogleStrategy;//, ensureLoggedIn;

if (process.env.GCID && process.env.GSECRET) {
  passport = require('passport');
  GoogleStrategy = require('passport-google-oauth20').Strategy;
  //ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GCID,
      clientSecret: process.env.GSECRET,
      callbackURL: '/auth/google/callback',
    },
    (_accessToken, _refreshToken, profile, done) => { done(null, profile); }
  ));
  passport.serializeUser((user, done) => done(null, { email: user.emails[0].value, provider: user.provider, id: user.id }));
  passport.deserializeUser((user, done) => done(null, user));
}

MongoClient.connect(process.env.MONGO_URL || 'mongodb://localhost/', { useUnifiedTopology: true },
  (err, dbase) => {
    let app, sessionParser, sharedb, server, wss;
    if (err) throw err;

    sessionParser = session({
      secret: 'palapala',
      name: 'palapala',
      cookie: { maxAge: 31536000000 },
      saveUninitialized: true,
      resave: true,
      store: new MongoStore({ client: dbase }),
    });

    sharedb = new ShareDb({ db: sharedbMongo({ mongo: (cb) => { cb(null, dbase) } }) });
    sharedb.addProjection('document_list', 'palapala', { id: true });

    app = express();
    app.use(sessionParser);

    if (GoogleStrategy) {
      app.use(passport.initialize());
      app.use(passport.session());
      app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
      app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/auth/google' }),
        (req, res) => res.redirect(req.session.lastURL || '/'));
      app.get('/logout', (req, res) => {
        req.logout();
        res.redirect('/');
      });
      //app.all('/:id/', ensureLoggedIn('/auth/google'));      
    }

    app.use("/:id/", express.static(path.join(__dirname, "..")));
    app.use("/", (_req, res) => res.redirect("/" + shortid.generate()));

    server = app.listen(process.env.PORT || 8000);
    wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (req, sock, head) => {
      sessionParser(req, {}, () => {
        if (req.session.passport && req.session.passport.user) {
          req.user = req.session.passport.user;//.emails[0].value;
        }
        wss.handleUpgrade(req, sock, head, (ws) => { wss.emit('connection', ws, req) });
      });
    });


    wss.on('connection', (ws, req) => {
      console.log('connection accepted', req.url, req.user, req.sessionID);
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
    sharedb.allowCreate('palapala', async (_id, _doc, _sess) => true);
    sharedb.allowRead('palapala', async (_id, _doc, _sess) => true);
    sharedb.allowUpdate('palapala', async (_id, oldDoc, _newDoc, _ops, sess) => oldDoc.edit || sess.userID === oldDoc.owner);
    sharedb.allowDelete('palapala', async (_id, _doc, _sess) => false);

    function close(obj) {
      return new Promise((resolve, reject) => {
        obj.close((err, res) => { if (err) reject(err); else resolve(res); })
      });
    }

    async function shutdown() {
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

    process.on('SIGUSR2', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

