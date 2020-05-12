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
$ npm build
```
Currently you also need to create a soft link pointing `lib` to `node_modules`. (see TODO)

The use of a MongoDB backend is hardcoded right now. You must provide the database connection URL as an environment variable `MONGO_URL` 

The start script runs `nodemon  js/server.js` and starts listening on port 8000.
```
$ MONGO_URL="[...secret...]" npm start 
```
Once the server is running direct a browser to `localhost:8000`


# TODO

- Build should copy all files intended for webhosting into a static `dist/` directory.
- Authentication! (Currently everyone has full write access to all documents.)
    + Edit/View modes
    + List/tree of user's documents.
- Multi-page whiteboards
- SVG export
- Placing images
- Options for backend. If no `MONGO_URL` is provided, it should fall back on the ShareDB in-memory database (non persistant)?

