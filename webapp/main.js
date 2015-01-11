"use strict"

var text_console, worker;
var log, info, warn;

 window.addEventListener('load', function() {

  text_console = document.getElementById('text_console');
  text_console.addEventListener('dblclick', function(e) { text_console.value = '' });

  log = function(s) { text_console.value = s + '\n' + text_console.value; console.log(s); };
  info = function(s) { text_console.value = s + '\n' + text_console.value; console.info(s); };
  warn = function(s) { text_console.value = s + '\n' + text_console.value; console.warn(s); };

  navigator.cancelAnimationFrame = navigator.cancelAnimationFrame || navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
  navigator.requestAnimationFrame = navigator.requestAnimationFrame || navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

  // TODO (4) : elem.requestFullscreen

  // TODO (1) : disconnect reset existing sources, workers and connections

  // init
  ui.setSourceStateDisconnected();

  // TODO : ui.fillSourcesOptions()

  var localCapabilities = [
    { type:'option', value: 'no_source', text: i18n.option_select_source},
    { type:'option', value: 'ws://127.0.0.1:8080/', text: i18n.option_localhost},
    { type:'option', value: '/dev/ttyUSB0', text: i18n.option_local_serial},
    { type:'option', value: 'file://', text: i18n.option_load_file},
    { type:'option', value: 'local_store', text: i18n.option_local_store},
    { type:'option', value: 'add_option', text: i18n.option_add}
  ]

  ui.addCapabilities(localCapabilities);

  var client_api_mapping = {
    system: { type: 'system' },
    serial0: { type: 'serial', name: 'OBCI USB' },
    serial1: { type: 'serial', name: 'Simulator' },
    filedb: { type: 'persistor', name: 'file://data/' }
  };

  // system.api(client_api_mapping);
});

var system = (function() {

  // private
  var anim_frame_request_id,
      redrawers = [];

  // public
  var sys = {
    registerAnim: function(redrawer) {

        redrawers.push(redrawer);

        var step = function (timestamp) {

            for (var r in redrawers) {
              redrawers[r]();
            }

            anim_frame_request_id = window.requestAnimationFrame(step);
        }

        if (anim_frame_request_id === undefined)
          anim_frame_request_id = window.requestAnimationFrame(step);
    },
    unregisterAnim: function(redrawer) {

      for (var i = 0 ; i < redrawers.length ; i++) {
        if (redrawer === redrawers[i]) {
          redrawers.splice(i, 1);
          break;
        }
      }

      if (redrawers.length === 0) {
        window.cancelAnimationFrame(anim_frame_request_id);
        anim_frame_request_id = undefined;
      }
    },
    auth: function() {
        log('user authentication');
        ui.showAuthModal();
    },
    api: function(api) {
      for (var i in api) {
        console.log('block ' + i + ' type:' + api[i].type + ' state:' + api[i].state + ' f:' + typeof  blocks_factory[api[i].type]);
        blocks[i] = blocks_factory[api[i].type](i, api[i]);
      };
    }
  }

  return sys;

})()



  /*
  // TODO (3) : UI

      createDocumentFragment();


        e = document.createElement(tag);
        for (var tag in model) {
          if (typeof tag[i] === 'object') {
            e.appendChild(gen(tag[i]));
          }
          else {
            e[tag] = model[tag];
          }
        }
        container.appendChild(e);
      }

      label: { textContent: i18n.connect_serial_to },
      input: { type: 'checkbox', value:  ?? server_data_config[i] }, NON if (type === 'serial') { new uiSerialPanel()
      label: { textContent: i18n.connect_to_ws },

      */


var ui_serial = function(identifier, options) {

  console.log('options');
  console.log(options);


  var performance_frame_count, performance_start_time;
  var fps, frame_count, frame_miss;

  var open_close_button, start_stop_button, board_state, board_error;

  var open_handler = function() {

    console.log('open handler');

    open_close_button.disabled = true;

    worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'open'
          }
    });
  }

  var close_handler =  function() {

    console.log('close handler');

    open_close_button.disabled = true;

    worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'close'
          }
        });

  }

  var stop_handler = function() {

    console.log('stop handler');

    start_stop_button.disabled = true;

    worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'stop',
            data: {
              connect_to_ws: false
            }
          }
    });

    system.unregisterAnim(bci_plot.redraw);
  }

  var start_handler =  function() {

    console.log('start handler');

    // start_stop_button.disabled = true;
    open_close_button.disabled = true;

    worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'start',
            data: {
              connect_to_ws: true
            }
          }
        });

        performance_frame_count = 0;
        performance_start_time = performance.now();

        system.registerAnim(bci_plot.redraw);
  }
    // system.addControl(name, e)
    var container = document.getElementById('blocks-control');

     var e, o = document.createElement('h1');
      o.textContent = (options ? options.name : false ) || i18n.unknown;
      container.appendChild(o);

      e = document.createElement('div');

     /*  // TODO (1) : dynamic dispatcher
      o = document.createElement('label');
      o.textContent = i18n.connect_serial_to;
      e.appendChild(o);

      o = document.createElement('input');
      o.type = 'checkbox';
      o.value = 'connect_to_ws';
      e.appendChild(o);
      o = document.createElement('label');
      o.textContent = i18n.connect_to_ws;
      e.appendChild(o);

      o = document.createElement('input');
      o.type = 'checkbox';
      o.value = 'connect_to_mongodb';
      e.appendChild(o);
      o = document.createElement('label');
      o.textContent = i18n.connect_to_mongodb;
      e.appendChild(o);

      o = document.createElement('input');
      o.type = 'checkbox';
      o.value = 'connect_to_filedb';
      e.appendChild(o);
      o = document.createElement('label');
      o.textContent = i18n.connect_to_filedb;
      e.appendChild(o); */

      open_close_button = document.createElement('input');
      open_close_button.className = 'serial_start_stop_button';
      open_close_button.type = 'button';
      e.appendChild(open_close_button);

      start_stop_button = document.createElement('input');
      start_stop_button.className = 'serial_start_stop_button';
      start_stop_button.type = 'button';
      e.appendChild(start_stop_button);

      fps = document.createElement('var');
      fps.textContent = 0;
      e.appendChild(fps);
      o = document.createElement('label');
      o.textContent = i18n.sps;
      e.appendChild(o);
      frame_count = document.createElement('var');
      frame_count.textContent = 0;
      e.appendChild(frame_count);
      o = document.createElement('label');
      o.textContent = i18n.frame_count;
      e.appendChild(o);
      frame_miss = document.createElement('var');
      frame_miss.textContent = 0;
      e.appendChild(frame_miss);
      o = document.createElement('label');
      o.textContent = i18n.frame_miss;
      e.appendChild(o);

      board_state = document.createElement('span');
      board_state.id = 'board_state'; // for applying styles
      e.appendChild(board_state);

      board_error = document.createElement('span');
      board_error.id = 'board_error'; // for applying styles
      board_error.addEventListener('dblclick', function(e) { board_error.textContent = ''; board_error.style.display = 'none'; });
      e.appendChild(board_error);


      container.appendChild(e);

  var api = {
    ondata: function(data) {

      frame_count.textContent = performance_frame_count++;
      fps.textContent = (1000 * performance_frame_count / (performance.now() - performance_start_time)).toFixed(2);

      bci_data.feed(data.samples);
      // TODO (1)  : process data.accel
    },
    oncontrol: function(m) {
      console.log('serial unknown oncontrol ' + m.data + ' control' + m.control); // TODO (1) : request decoder
      console.log(m);
    },
    onstate: function(m) {
      console.log(identifier + ' onstate ' + m.old_state + ' >> ' + m.state); // TODO (1) : request decoder

      board_state.textContent = i18n.board_state[m.state];
      board_state.className = m.state;
      switch (m.state) {
        case 'STATE_CLOSED':
          open_close_button.value = i18n.open;
          open_close_button.onclick = open_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.disabled = true;
          break;
        case 'STATE_OPENING':
        case 'STATE_INIT':
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.disabled = true;
          break;
        case 'STATE_IDLE':
          console.log('idle (onready) '  + m.control);
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.onclick = start_handler;
          start_stop_button.disabled = false;
          break;
        case 'STATE_STREAMING':
          open_close_button.value = i18n.close;
          open_close_button.disabled = true;
          start_stop_button.value = i18n.stop;
          start_stop_button.onclick = stop_handler;
          start_stop_button.disabled = false;
          break;
        case 'STATE_WAIT_ENDING':
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = true;
          start_stop_button.value = i18n.stop;
          start_stop_button.disabled = true;
          break;
        default:
          console.error('unknown state');
          break;
      }
    },
    onerror: function(data) {
      console.error(data);
      log(data);
      board_error.textContent = data; // TODO (2) : board_error i18n
      board_error.style.display = 'inline';
    }
  }
  // apply current state to ui
  api.onstate(options);

  return api;
}


var ui_change_source_handler = function(e) {
    var data_source = document.getElementById('data-source');
    var path = data_source.options[data_source.selectedIndex].value;

    if (path.indexOf('ws') !== -1) {

      log('Connecting websocket ' + path);
      worker = new Worker(window.URL.createObjectURL(new Blob([document.getElementById('bci_worker').textContent], { type: "text/javascript" })));

      worker.onmessage = function(e) {

        var message = e.data;

        if (message.error) {
          // log('websocket error ' + e);
          console.error(e);
        }
        if (message.log) {
          log('websocket  >' + message.log);
        }
        if (message.event) {
          if (message.event === 'close') {
            log('websocket close code:' + message.code + ' reason:' + message.reason);

            worker.terminate();
            ui.setSourceStateDisconnected();
            document.getElementById('data-source-state').onclick = ui_change_source_handler;
            ui.hidePanel(worker.ID); // TODO (0) : ID -> server
          }
          else if (message.event === 'open') {
            ui.setSourceStateConnected();
            worker.postMessage({action: 'send', data: {} }); // request for capabilities, default server response to empty message  // data: { target: SYSTEM.ID, event: SYSTEM.EVENT_REQUEST_CAP }
          }
          return;
        }
        if (message.action) {
          if (message.target) {
            // console.log('dispatch target:' + message.target + ' action:' + message.action + ' data:' + message.data + ' block:' + blocks[message.target]);
            blocks[message.target][message.action](message.data);
          }
          else {
            console.log('dispatch default target (system) action:' + message.action + ' data:' + message.data + ' block:' + blocks[message.target]);
            system[message.action](message.data);
          }
        }
        else { console.log('dispatch no action:' + message); }
      }

      worker.postMessage({action: 'create', path: path });

    }
    else if (path.indexOf('tty') !== -1 ) {
      if (typeof chrome === 'object' && chrome.serial) {
        log("importScript('chromeapp.js');");
        importScript('chromeapp.js');
        // chromeapp.init();
      }
      else {
        warn(i18n.chrome_app_warn);
      }
    }
    else if (path.indexOf('file') !== -1 ) {
      log("importScript('fileloader.js');");
      importScript('fileloader.js', function() {fileLoader.init()});
    }
    else if (path === 'no_source') {
      log(i18n.select_source);
    }
    else {
      info(i18n.not_implemented + path);
    }
  };

var blocks_factory = {
  system: function(identifier, options) {
    return system; // singleton
  },
  serial: ui_serial,
  persistor: function(identifier, options) { console.log('TODO ui persistor')}
}

var blocks = {};

var ui = {
  setSourceStateConnected: function() {
    document.getElementById('data-source').style.display = 'none'; // hide
    var e =  document.getElementById('data-source-state');
    e.textContent = i18n.do_disconnect;
    e.className = 'connected';
    e.onclick = function(e) { worker.postMessage({action: 'close' }); };
  },
  setSourceStateDisconnected: function() {
    var e = document.getElementById('data-source');
    e.selectedIndex = 0; // TODO (3) bindings, model.value = 'no_source';
    e.style.display = 'inline'; // show
    e = document.getElementById('data-source-state');
    e.textContent = i18n.do_connect;
    e.className = 'disconnected';
    e.onclick = ui_change_source_handler;
  },
  showAuthModal: function() {
      document.getElementById('form-auth').addEventListener('submit', function() {
      worker.postMessage({
        action: 'send',
        data: {
          id: document.getElementById('user-id').value,
          pwd: document.getElementById('user-pwd').value
        }
      });
      document.getElementById('form-auth').removeEventListener('submit');
      document.getElementById('panel-auth').style.display = 'none'; // hide
      return false;
    });
    document.getElementById('panel-auth').style.display = 'block'; // show
  },
  addCapabilities: function(list) { // TODO : (5) optgroup
    var o, e = document.getElementById('data-source');
    for (var i = 0 ; i < list.length ; i++) {
      o = document.createElement(list[i].type);
      o.value = list[i].value;
      o.textContent = list[i].text;
      e.appendChild(o);
    }
  },
  hidePanel : function(id) {
    // TODO (0) : only delete id specific
    var e = document.getElementById('blocks-control');
    while (e.firstChild) {
      e.removeChild(e.firstChild);
    }
  }
}


// UTILS

var importScript = function(src, callback) {
  // TODO (0) : cache ? if (cached) callback()
    var script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    script.onerror = function(e) { warn('error loading ' + e)};
    document.head.appendChild(script);
}

// TODO (4) : importScripts(i18n + lang + .js); set accordding to browser locals or users preferences from server

var i18n_en = {
  not_implemented: 'Not implemented :',
  chrome_app_warn: 'Serial requires application to be launched as a Chrome App.', // TODO (5) : see http://...tuto###
  select_source: 'Please select a data source',
  do_connect: 'Connect',
  do_disconnect:  'Disconnect',
  option_select_source: 'Select a source...',
  option_local_serial: 'Browser serial port : /dev/ttyUSB0',
  option_load_file: 'Load file...',
  option_local_store: 'Browser LocalStore',
  option_add: 'Add source...',
  option_localhost: 'Localhost : ws://127.0.0.1:8080/',
  option_server: 'Server : ws://ws-yenah.rhcloud.com:8000/',
  connect_serial_to: 'Stream serial data to : ',
  connect_to_ws: 'Browser',
  connect_to_mongodb: 'Mongodb',
  connect_to_filedb: 'file',
  sps: 'sps', // samples per second
  frame_count: 'samples',
  frame_miss: 'miss',
  start: 'Start',
  stop: 'Stop',
  open: 'Open',
  close: 'Close',
  unknown: 'Unknown',
  board_state: {
    'STATE_CLOSED': 'Closed',
    'STATE_OPENING': 'Opening...',
    'STATE_INIT': 'Waiting for board ack...',
    'STATE_IDLE': 'Ready',
    'STATE_STREAMING': 'Streaming data',
    'STATE_WAIT_ENDING': 'Busy...'
  }
}

var i18n_fr = {
  not_implemented: 'Non implementé :',
  chrome_app_warn: "Lancer en tant qu'application Chrome est requis pour utiliser le port USB.", // TODO (5) : Voir http://...tuto###
  select_source: 'Veuillez sélectionner une source de données',
  do_connect: 'Connecter',
  do_disconnect :  'Déconnecter',
  option_select_source: 'Sélectionnez une source...',
  option_local_serial: 'Port série via le navigateur : /dev/ttyUSB0',
  option_load_file: 'Charger un fichier...',
  option_local_store: 'LocalStore du navigateur',
  option_add: 'Ajouter une source...',
  option_localhost: 'Localhost : ws://127.0.0.1:8080/',
  option_server: 'Serveur : ws://ws-yenah.rhcloud.com:8000/',
  connect_serial_to: 'Données série vers : ',
  connect_to_ws: 'navigateur',
  connect_to_mongodb: 'Mongodb',
  connect_to_filedb: 'fichier',
  sps: 'eps', // échantillons par seconde
  frame_count: 'échantillons',
  frame_miss: 'ratés',
  start: 'Démarrer',
  stop: 'Arrêter',
  open: 'Ouvrir',
  close: 'Fermer',
  unknown: 'Inconnu',
    board_state: {
    'STATE_CLOSED': 'Fermée',
    'STATE_OPENING': 'Ouverture en cours...',
    'STATE_INIT': 'Attente réponse carte...',
    'STATE_IDLE': 'Prête',
    'STATE_STREAMING': 'Flux de données',
    'STATE_WAIT_ENDING': 'Occupée...'
  }
}

var i18n = i18n_fr;
