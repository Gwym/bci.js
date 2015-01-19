"use strict"

var text_console, worker;
var log, info, warn;

 window.addEventListener('load', function() {

  text_console = document.getElementById('text_console');
  text_console.addEventListener('dblclick', function(e) { text_console.value = '' });

  log = function(s) { var d = new Date(); text_console.value = d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' > ' + s + '\n' + text_console.value; };
  info = function(s) { text_console.value = s + '\n' + text_console.value; console.info(s); };
  warn = function(s) { text_console.value = s + '\n' + text_console.value; console.warn(s); };

  navigator.cancelAnimationFrame = navigator.cancelAnimationFrame || navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
  navigator.requestAnimationFrame = navigator.requestAnimationFrame || navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

  // TODO (4) : elem.requestFullscreen

  // TODO (1) : disconnect reset existing sources, workers and connections

  // init
  ui.setSourceStateDisconnected();

  // toggle canvas visibility
  var canvas_state_button = document.getElementById('canvas-state');
  canvas_state_button.onclick = function() {
    var canvas_container =  document.getElementById('canvas_container');
    if (canvas_container.style.display === 'none') {
      canvas_container.style.display = 'block';
      canvas_state_button.textContent = i18n.hide_canvas;
    }
    else {
      canvas_container.style.display = 'none';
      canvas_state_button.textContent = i18n.show_canvas;
    }
  }
  canvas_state_button.textContent = i18n.hide_canvas;

  var auto_connect = false; // TODO (2) : allow for connecting mutliple server ?  if  yes, put auto_connect in loaclCapabilities
  var  localCapabilities = [
    { type:'option', value: 'no_source', text: i18n.option_select_source},
    { type:'option', value: 'ws://127.0.0.1:8080/', text: i18n.option_localhost, selected: true},
    { type:'option', value: '/dev/ttyUSB0', text: i18n.option_local_serial},
    { type:'option', value: 'file://', text: i18n.option_load_file},
    { type:'option', value: 'local_store', text: i18n.option_local_store},
    { type:'option', value: 'add_option', text: i18n.option_add}
    ];

  ui.addCapabilities(localCapabilities);

  if (auto_connect) {
    document.getElementById('data-source-state').dispatchEvent(new MouseEvent('click'));
  }

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


// var ui_serial = require('ui_serial.js'); // imported in index.html for now

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
          log('websocket > ' + message.log);
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

      if (list[i].selected) {
        e.selectedIndex = i;
      }
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
// TODO (5) : separate i18n par blocks (ui_serial, etc)

var i18n_en = {
  not_implemented: 'Not implemented :',
  chrome_app_warn: 'Serial requires application to be launched as a Chrome App.', // TODO (5) : see http://...tuto###
  select_source: 'Please select a data source',
  do_connect: 'Connect',
  do_disconnect:  'Disconnect',
  hide_canvas: 'Hide canvas',
  show_canvas: 'Show canvas',
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
    STATE_CLOSED: 'Closed',
    STATE_OPENING: 'Opening...',
    STATE_INIT: 'Waiting for board ack...',
    STATE_IDLE: 'Ready',
    STATE_STREAMING: 'Streaming data',
    STATE_WAIT_ENDING: 'Busy...',
    STATE_WRITING: 'Writing...'
  },
  board_settings: 'Settings : ',
  board_settings_button: 'Settings',
  bsb_get: 'Get channels',
  bsb_get_registers: 'Get registers',
  bsb_set: 'Apply changes',
  bsb_reset: 'Reset to default',
  bsb_cancel: 'Cancel changes',
  adc_disabled: 'Disable',
  adc_gain: 'Gain',
  adc_input_type: 'Input type',
  adc_input_type_hint: 'ADC channel input source',
  adc_input_type_values: ['NORMAL', 'SHORTED', 'BIAS_MEAS', 'MVDD', 'TEMP', 'TESTSIG', 'BIAS_DRP', 'BIAS_DRN'],
  adc_bias_hint: 'Include the channel input in BIAS generation',
  adc_bias: 'Bias',
  adc_SRB2: 'SRB2',
  adc_SRB2_hint: 'Connect the channel P input to the SRB2 pin',
  adc_SRB1: 'SRB1',
  adc_SRB1_hint: 'Disconnect all N inputs from the ADC and connect them to SRB1.',
  adc_impedance_p: 'Lead-off P',
  adc_impedance_n: 'Lead-off N',
  adc_impedance_p_hint: 'Lead-off impedance P (see http://www.ti.com/lit/an/sbaa196/sbaa196.pdf)',
  adc_impedance_n_hint: 'Lead-off impedance N (see http://www.ti.com/lit/an/sbaa196/sbaa196.pdf)',
  adc_channel: 'Channel',
  channels: ['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4', 'Channel 5', 'Channel 6', 'Channel 7', 'Channel 8'],
  reset_board: 'Reset board'
}

var i18n_fr = {
  not_implemented: 'Non implementé :',
  chrome_app_warn: "Lancer en tant qu'application Chrome est requis pour utiliser le port USB.", // TODO (5) : Voir http://...tuto###
  select_source: 'Veuillez sélectionner une source de données',
  do_connect: 'Connecter',
  do_disconnect :  'Déconnecter',
  hide_canvas: 'Cacher le canvas',
  show_canvas: 'Afficher le canvas',
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
    STATE_CLOSED: 'Fermée',
    STATE_OPENING: 'Ouverture en cours...',
    STATE_INIT: 'Attente réponse carte...',
    STATE_IDLE: 'Prête',
    STATE_STREAMING: 'Flux de données',
    STATE_WAIT_ENDING: 'Occupée...',
    STATE_WRITING: 'Ecriture...'
  },
  board_settings: 'Réglages : ',
  board_settings_button: 'Réglages',
  bsb_get: 'Lire les canaux',
  bsb_get_registers: 'Lire les registres',
  bsb_set: 'Appliquer les changements',
  bsb_reset: 'Valeurs par défaut',
  bsb_cancel: 'Annuler les changements',
  adc_disabled: 'Désactiver',
  adc_gain: 'Gain',
  adc_input_type: "Type d'entrée",
  adc_input_type_hint: "Source d'entrée du canal",
  adc_input_type_values: ['NORMAL', 'SHORTED', 'BIAS_MEAS', 'MVDD', 'TEMP', 'TESTSIG', 'BIAS_DRP', 'BIAS_DRN'],
  adc_bias_hint: "Inclure l'entrée du canal dans la génération du BIAS",
  adc_bias: 'Bias',
  adc_SRB2: 'SRB2',
  adc_SRB2_hint: "Connecter l'entrée P du canal à la broche SRB2",
  adc_SRB1: 'SRB1',
  adc_SRB1_hint: "Déconnecter toutes les entrées N de de l'ADC et les connecter à la broche SRB1",
  adc_impedance_p: 'P',
  adc_impedance_n: 'N',
  adc_impedance_p_hint: 'Impédance de fuite P (voir http://www.ti.com/lit/an/sbaa196/sbaa196.pdf)', // 'de fuite' ? 'sans dérivation' ?
  adc_impedance_n_hint: 'Impédance de fuite N (voir http://www.ti.com/lit/an/sbaa196/sbaa196.pdf)', // 'de fuite' ? 'sans dérivation' ?
  adc_channel: 'Canal',
  channels: ['Canal 1', 'Canal 2', 'Canal 3', 'Canal 4', 'Canal 5', 'Canal 6', 'Canal 7', 'Canal 8'],
  reset_board: 'Reset carte'
}

var i18n = i18n_en;
