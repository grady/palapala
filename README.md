# Palapala

Palapala is an collaborative whiteboard browser app powered by [Paper.js](https://paperjs.org) and [ShareDB](https://github.com/share/sharedb).
It has a drawing tool set geared towards mathematics instruction.
In particular it has tools for placing third-party graphing calculator apps onto the canvas, manipulating them collaboratively, and drawing freehand over the inserted graph.

This project was started because I needed a live whiteboard tool for distance learning use during the COVID-19 pandemic and could not locate a suitable Free Software solution.

# Installation

Install using `npm` like any Node.js package.
```
$ git clone [...]
$ cd palapala/app
$ npm install .
$ npm run-script build
$ npm run-script dist
```


If environment variable `MONGO_URL` is set, ShareDB will use a MongoDB backend. Othwewise it uses ShareDB's in-memory database test backend.

If you set `GKEY` and `GSECRET` it will attempt to use Google's OAuth2 API to login.

The start script runs `nodemon  js/server.js` and starts listening on env var PORT || 8000.


```
$ docker-compose build
```

```
$ docker-compose up
```

Once the server is running direct a browser to `localhost:8000`. You will be redirected to a randomly generated document id `/:id/`

`/:id/view/` gives a view-only interface with no controls other than pan. (Currently only a client side toolbar CSS `display: none`.)

# TODO

- Authentication! (Currently everyone has full write access to all documents.)
    + Edit/View modes
    + List/tree of user's documents.
- Multi-page whiteboards
- SVG export
- Placing images
