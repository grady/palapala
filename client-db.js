global.socket = function(){
  let ReconnectingWebSocket = require('reconnecting-websocket');
  let sharedb = require('sharedb/lib/client');
  let socket = new ReconnectingWebSocket("ws://localhost:8080");
  return new sharedb.Connection(socket);
}
