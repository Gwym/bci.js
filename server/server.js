// node.js server for bci.js (brain controller interface in Javascript)
// usage : node server.js  or  node --harmony server.js if simulator is used
//
// Created: Jan 2015, <gwym.hendawyr@gmail.com>
//
// May require, depending on configuration : serial-nodeport, ws, node-mongodb-native
//
// SOFTWARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED

"use strict"

// CONFIGURATION
// TODO (5) : loadFile(configuration.json)

var configuration =  {
  authenticate: false, // true: user auth required - NOT IMPLEMENTED
  serve_webapp: true
}

//  Set the environment variables we need.
var env = {
	ipaddress: process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
	port: process.env.OPENSHIFT_NODEJS_PORT || 8080,

	db_host: process.env.OPENSHIFT_MONGODB_DB_HOST || '127.0.0.1',
  db_port: process.env.OPENSHIFT_MONGODB_DB_PORT || 27017,
  db_name: process.env.OPENSHIFT_APP_NAME || 'ws',
  db_user: (process.env.OPENSHIFT_MONGODB_DB_USERNAME ? process.env.OPENSHIFT_MONGODB_DB_USERNAME
                + ':' + process.env.OPENSHIFT_MONGODB_DB_PASSWORD + '@'
                : ''),
  filedb_path: process.env.OPENSHIFT_DATA_DIR || './data'
}

// array of blocks to load

var blocks = {
  // system: { require:'./blocks/user_manager.js', type: 'system', options: { persistor: 'filedb' } },
  serial0: { require:'./blocks/obci_serial.js', type: 'serial', name: 'OBCI USB', options: { port :'/dev/ttyUSB0', baudrate: 115200, log_control: false } },
  // serial1: { require:'./blocks/obci_serial.js', type: 'serial', name: 'Simulator', options: { use_simulator: false, framerate: 1000, log_control: false } },
  // filedb: { require:'./blocks/persistor_file.js', type: 'persistor', name: 'file://data/', options: { path: env.filedb_path } }
  // mongodb: { require:'./blocks/persistor_mongodb.js', type: 'persistor', name: 'Mongodb', options: { env: env } }
}

// END OF CONFIGURATION


var fs = require('fs');
var http = require('http');
// if (configuration.serve_webapp)
var FileServer = require('node-static');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

// block  auth
var bcrypt = require('bcrypt');
// end block auth


// block mongodb

var MongoClient;

var knowlege = null;
var tracks = null;

try {
  MongoClient = require('mongodb').MongoClient;
}
catch (e) {
  console.log('Mongodb module not found, fallback to memory/file');
  MongoClient = { connect: function() {console.log('TODO datastore.connect')} };
  tracks = {insert: function(data, options, callback) {console.log('TODO tracks.insert ' + data); callback(null, data)} };

  var users = {
    find: function(login) { return {}}
  }
}

/*

var mongo_url = 'mongodb://' + env.db_user + env.db_host + ':' + env.db_port + '/' + env.db_name;

MongoClient.connect(mongo_url, function(err, db) {

  if (err) {
    throw err;
  }

  db.on('error', function(err) {
            console.warn('DB ERROR');
            console.error(err);
  });

  knowlege = db.collection('knowlege');
  tracks = db.collection('tracks');

  console.log('MongoClient connected to ' + mongo_url);

});

// end block mongodb
*/

var file = new FileServer.Server('../webapp', { indexFile: "index.html" });

var server = http.createServer(function (req, res) {

	console.log(req.url + ' ' + req.connection.remoteAddress);

	req.headers.url = req.url;
	req.headers.ip = req.connection.remoteAddress;

  tracks.insert(req.headers, {w:1}, function(err, res) {
    console.log('tracks insert callback 1 ' + err + ' ' + res);
  });

	req.addListener('end', function () {
        file.serve(req, res, function (err, result) {
            if (err) {
                console.log(err);
                console.log(result);
                tracks.insert(err, {w:1}, function(err, res) {
                  console.log('tracks insert callback 1 ' + err + ' ' + res);
                });
                res.writeHead(err.status, err.headers);
                res.end('<!DOCTYPE html><html><head><head><body>404 : Brain not found.</body></html>');
            }
        });
  }).resume();
}).listen(env.port, env.ipaddress);

console.log('%s: Node server started on %s:%d',
         Date(Date.now()), env.ipaddress, env.port);


// cf. OPENSHIFT doc : plain WebSockets ws:// will use port 8000 and secured connections wss:// port 8443

var wss = new WebSocketServer(
	{ server: server, clientTracking: true }, // TODO (2) : verifyClient
	function() {
  		  console.log('WS > listen callback ' );
});

var broadcast = function(message) {

  // console.log('broadcast ' +  JSON.stringify(message));

  for (var i = 0 ; i < wss.clients.length ; i++) {
    if (wss.clients[i].readyState === WebSocket.OPEN) {
      wss.clients[i].sendJSON(message);
    }
    else {
      console.warn('client ' + i + ' is not open, discarding message.');
    }
  }
}

var dispatcher = broadcast; // TODO (2) : dispatcher, connection selection, authorization

var client_api_mapping = {};

for (var b in blocks) {

  if (!blocks[b].require || !blocks[b].options || !blocks[b].type) {
    throw new Error('Configuration error > Missing require, options or type in ' + b );
  }
  client_api_mapping[b] = { type: blocks[b].type, name: blocks[b].name};
  blocks[b] = require(blocks[b].require).factory(b, blocks[b].options, dispatcher );
}

/*
ws.on('message', function(data, flags) {
  // flags.binary will be set if a binary data is received.
  // flags.masked will be set if the data was masked.
});

ws.send(array, { binary: true, mask: true });
*/

var ws_connection_counter = 0; // TODO (2) : nodeObserver

wss.on('connection', function(ws) {

	if (ws.protocol !== 'yh0.0.1') {
		console.log('WS > bad protocol, closing ' + toStr(ws) );

		ws.close(1000, 'PROTOCOL ERROR');
		return;
	}

	//console.log('WS > connection ' + toStr(ws) );
	console.log('WS connection > clients# ' + wss.clients.length + ' ws_connection_counter:' + ws_connection_counter );
  ws.ID = ws_connection_counter++;

	var setMessageHandler = function() {

	  ws.on('close', function() {
	    console.log('WS > close  ' + ws.userID);
	  });

	  ws.sendJSON = function(o) { this.send(JSON.stringify(o)) };

    // TODO (1) : replace once by node addListener + removeListener('message', f)
    ws.on('message', 	function(message) { // autenthicated onmessage

            // TODO (2) : if (message instanceof ArrayBuffer && ws.raw_dispatcher) { ws.raw_dispatcher(message) }  // incoming data, destination previously defined
            // else
    				try {

    					var m = JSON.parse(message);
    					console.log('WS > received: %s on userID: %s', message, ws.ID + ' target:'  + typeof m.target);

    					if (m.origin) {
    					  console.warn('overwriting message.origin');
    					}
    					m.origin = ws.ID;

              // TODO (2) : limit target and action to numbers to avoid calling javascript API or check
    					// if (!isNaN(parseInt(m.target, 10)) && dispatcher[m.target]) {
    					// if ( typeof m.target === 'number' && dispatcher[m.target]) {
    					// dispatcher[m.target](m, ws);
    					if (m.target && m.action) {
    					  blocks[m.target][m.action](m.data, ws);
    					}
    					else {
    					  defaultDispatcher(m, ws);
    					}
    				}
    				catch(e) {
    					console.log('WS > error ' + e + ', closing ' + ws.ID );
	            console.log(message.data);
	            throw e; // console.error(e);
    					ws.close(1000, 'JSON ERROR OR DISPATCHING ERROR'); // TODO (3) : separate JSON and DISPATCHING exceptions
    				}

    });

    // ws.onopen
    // ws.onerror
    // ws.onclose
	}

	if (configuration.authenticate) {

    // set auth handler
  	ws.once('message', function(message) { // unsafe onmessage

  		console.log('WS auth > received: %s', message);

  		var u;

  		try {

    		u = JSON.parse(message);

    		// TODO : find user in db, if user found, check action_date or set action_date = new date();
    		var user = users.find({login: u.id});

    		// check user id/pwd
    		console.log('WS > check user ' + u );
    		if (bcrypt.compareSync( u.pwd, user.password_hash )) {

    			ws.userID = user.id;
    		  setMessageHandler();
    		}
    		else {
    		  ws.close(1000, 'AUTH FAILED');
    		}

  		}
  		catch(e) {
  			console.log('WS auth > error ' + e + ', closing ' + toStr(ws) );
  			ws.close(1000, 'JSON AUTH ERROR');
  		}

  	}); // auth once

  	// request auth
	  ws.sendJSON( {target: 'system', action:'auth'} );
	}
	else {
	  console.log('server > No user, set guest handler');
	  setMessageHandler();
	}

});

var defaultDispatcher = function(req, ws) {
  if (req.action) {
    // TODO (3) : system wide actions, asynchrone reactions
    console.log('TODO : system action ?');
  }
  else { // default action : send server capabilities and state
    var current_api_state = {};
    for (var i in client_api_mapping) {
      current_api_state[i] = { type:client_api_mapping[i].type };
      if (client_api_mapping[i].name) {
        current_api_state[i].name = client_api_mapping[i].name;
      }
      if (blocks[i].getState) {
        current_api_state[i].state = blocks[i].getState();
      }
    }
    console.log('dispatcher > Send { action: "api", data:'  + JSON.stringify(current_api_state) + '}');
    ws.sendJSON( { action: 'api', data: current_api_state } );
  }
}

var replyAsync = function(wsID, message) {

  console.log('replyAsync to ' + wsID);

  var ws;

  for (var i = 0 ; i < wss.clients.length ; i++) {
    if ( wss.clients[i].ID === wsID) {
      ws =  wss.clients[i];
    }
  }

  if (ws) {
    ws.send(JSON.stringify(message));
  }
  else {
    console.warn('no socket ' + wsID + ' for message ' + JSON.stringify(message));
  }
}
