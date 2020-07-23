# Palapala

Palapala is an collaborative whiteboard browser app powered by [Paper.js](https://paperjs.org) and [ShareDB](https://github.com/share/sharedb).
It has a drawing tool set geared towards mathematics instruction.
In particular it has tools for placing third-party graphing calculator apps onto the canvas, manipulating them collaboratively, and drawing freehand over the inserted graph.

This project was started because I needed a live whiteboard tool for distance learning use during the COVID-19 pandemic and could not locate a suitable Free Software solution.

# Installation

Install using `npm` like any Node.js package.
```
$ git clone [...]
$ cd palapala
$ npm install .
$ npm run build
$ npm dist
```


Environment variable `MONGO_URL` should eb a url to a mongo database.

The start script runs `nodemon  js/server.js` and starts listening on environment variable PORT || 8000.
```
$ MONGO_URL="[...secret...]" npm start
```
Once the server is running direct a browser to `localhost:8000` (or whatever the server machine's address is). You will be redirected to a randomly generated document id `/:id/`

# TODO

- Authentication.
    + This is partially implemented and uses a session id to recognize a document owner.
    + List/tree of user's documents.
- Multi-page whiteboards
- SVG export
