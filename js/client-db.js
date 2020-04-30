globals.socket = function(){
  let ReconnectingWebSocket = require('reconnecting-websocket');
  let ShareDb = require('sharedb/lib/client');
  let socket = new ReconnectingWebSocket("ws://localhost:8080");
  return new ShareDb.Connection(socket);
}
