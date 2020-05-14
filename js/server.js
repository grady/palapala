const express = require('express');
const app = express();
const path = require('path')
const shortid = require('shortid');
let session = require('express-session');
let passport, GoogleStrategy;

app.use(session({ secret: 'palapala' }));

if (process.env.GSECRET) {

    passport = require('passport');
    GoogleStrategy = require('passport-google-oauth20').Strategy;

    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GKEY,
            clientSecret: process.env.GSECRET,
            callbackURL: "/auth/google/callback",
            proxy: true
        },
        function (token, tokenSecret, profile, done) {
            done(null, profile);
        })
    );
    
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    app.use(passport.initialize());
    app.use(passport.session());

    app.get(
        "/auth/google",
        passport.authenticate('google', { scope: ["email", "profile"] })
    );
    app.get(
        "/auth/google/callback",
        passport.authenticate('google', { failureRedirect: "/" }),
        function (req, res) {
            console.log(req.user.displayName, req.user.emails[0].value);
            res.redirect(req.session.returnUrl || "/")
        }
    );
}

function ensureAuthenticated(req, res, next) {
    if (!process.env.GSECRET || req.isAuthenticated()) {
        next();
    }
    else {
        req.session.returnUrl = req.originalUrl;
        res.redirect("/auth/google")
    }
}


app.use("/static/", express.static(path.join(__dirname, "..", "static")));
app.use("/:id/view/", express.static(path.join(__dirname, "..")));
app.use(
    "/:id/",
    ensureAuthenticated,
    express.static(path.join(__dirname, ".."))
);
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