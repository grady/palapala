

$(document).ready(() => {
  globals.socket = (function () {
    let ReconnectingWebSocket = require('reconnecting-websocket');
    let ShareDb = require('sharedb/lib/client');
    let socket, conn;
    return function () {
      let url = new URL(document.location);
      url.port = 8080;
      url.protocol = "ws";
      if (!socket) socket = new ReconnectingWebSocket(url.href);
      if (!conn) conn = new ShareDb.Connection(socket);
      return conn
    }
  })();
  globals.json = require("ot-json0").type;
  //globals.diff = require("json0-ot-diff");
  globals.isequal = require("lodash.isequal");
});

