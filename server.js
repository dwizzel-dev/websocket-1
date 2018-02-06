'use strict';

const _ = require('lodash');
const session = require('express-session');
const express = require('express');
const uuid = require('uuid');
const app = express();
const WebSocket = require('./lib');
const server = require('http').Server(app);

// sockets holder object
var wSockets = {};

// We need the same instance of the session parser in express and
// WebSocket server.
const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

// Serve static files from the 'public' folder.
app.use(express.static('public'));
app.use(sessionParser);

app.post('/login', (request, response) => {
  // "Log in" user and set userId to session.
  const id = uuid.v4();
  console.log(`Updating session for user ${id}`);
  request.session.userId = id;
  try {
    response.send({ result: 'OK', message: 'Session updated' });
  } catch (e) {
    console.log(e);
  }
});

app.delete('/logout', (request, response) => {
  console.log('Destroying session');
  try {
    let sessionId = request.session.userId;
    request.session.destroy();
    _.find(wSockets, {'userId': sessionId}).close();
  } catch (err) {
    console.log(err);
  }
  try {
    response.send({ result: 'OK', message: 'Session destroyed' });
  } catch (e) {
    console.log(e);
  }
});

const wss = new WebSocket.Server({
  // port: 80,
  verifyClient: (info, done) => {
    console.log('Parsing session from request...');
    sessionParser(info.req, {}, () => {
      console.log('Session is parsed!');
      // We can reject the connection by returning false to done(). For example,
      // reject here if user is unknown.
      done(info.req.session.userId);
    });
  },
  server
});

//
var removeWebSocket = (socketID) =>{
  _.unset(wSockets, socketID);
  broadcast(`removed ${socketID}`);
  console.log(`closing ${socketID}`);
};

// broadcasting
var broadcast = (msg, exceptIds = []) => {
  _.forEach(wSockets, (v, k) => {
    if (!_.includes(exceptIds, parseInt(k))) {
      v.send(msg, () => {
        console.log('wSockets[' + k + '] broadcast write');
      });
    }
  });
};

// le websocket event listener
var ws = (ws, req) => {
  ws.on('message', (msg) => {
    // Here we can now use session parameters.
    console.log(`WS message ${msg} from user ${req.session.userId}`);
  });
  ws.on('close', (code, reason) => {
    removeWebSocket(ws.id);
  });
  ws.on('error', (err) => {
    console.log(`socket error ${ws.id}: ${err}`);
  });
  ws.on('open', () => {
    // todo
  });
  ws.send(`welcome ${ws.id}!`, () => {
    console.log(`WS message sent`);
  });
};

// sockets ids
var socketIds = () => {
  return Math.floor(Math.random() * 1000);
};

// Connections
wss.on('connection', (webSocket, request) => {
  // add au array
  webSocket.id = socketIds();
  webSocket.userId = request.session.userId;
  wSockets[webSocket.id] = webSocket;
  ws(webSocket, request);
  broadcast(`new user ${webSocket.id}`, [webSocket.id]);
});
wss.on('error', (err) => {
  console.log(err);
});

// Start the server.
server.listen(8080, () => console.log('Listening on http://localhost:8080'));
