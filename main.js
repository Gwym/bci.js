"use strict"

// SERIAL

  var serial = null;
  var serial_path = '/dev/ttyUSB0'; // TODO : other platforms ?
  var serial_ID = undefined;
  var serial_connected = false;
  var serialWriteString = function(s) {
      console.log('serialWriteString > Sending:' + s + '(' + s.length + ')');
      serial.send(serial_ID, stringToArrayBuffer(s), function (e) {
        console.log('serialWriteString > Sent:' + e.bytesSent + ( e.error ? 'error:' + e.error : ''));
        if (e.error) {
          console.error('serial.send > Error :' + error);
        }
      })
  };
  var defaultDispatcher =  function(e) {
    var string = arrayBufferToString(e.data);
    text_console.log(string);
  	console.log('default dispatcher ' + e.connectionId + ' > ' + string.length + ' ' + string );
  };
  var serialDispatcher = defaultDispatcher;

  var text_console;

window.addEventListener("load", function() {

  // bci console

      text_console = document.getElementById('text_console');
      text_console.log = function(s) { this.value += s };

      navigator.cancelAnimationFrame = navigator.cancelAnimationFrame || navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
      navigator.requestAnimationFrame = navigator.requestAnimationFrame || navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

      var control_container = document.getElementById('control');

      for (var i in controls) {
        addButton(controls[i], control_container);
      }

      ui_fps = document.getElementById('fps'),
      ui_frame_count = document.getElementById('frame_count'),
      ui_frame_miss = document.getElementById('frame_miss');

      // @see https://developer.chrome.com/apps/serial

     if (!serial) {

        if (typeof chrome != 'undefined' && chrome.serial) {

          serial = chrome.serial;
        }
        else {
          console.error('No chrome serial : ' + chrome + ' chrome.serial : ' + chrome.serial + ' works only as webapp !!');
          // return;
          serial = SerialSimulator; // setting simulator
      	}
    }

    // debug force
    if (force_simulator)
      serial = SerialSimulator;

    document.title = 'bci.js - ' + (new Date()).toLocaleDateString() + ' - ' + serial.path;
  	  // serial.onReceive.addListener(function(e) { e: {connectionId:, ArrayBuffer data:} })
  	serial.onReceive.addListener(function(e) {
  	  // console.log('serial.onReceive ' + e.connectionId + ' > ' + e.data.byteLength + ' ' + e.data);
    		serialDispatcher(e);
  	});

  	// serial.onReceiveError.addListener(function(e) { e: {connectionId:, error:"disconnected", "timeout", "device_lost", or "system_error" }})
  	serial.onReceiveError.addListener(function(e) {
  	  console.warn('serial.onReceiveError ' + e.connectionId + ' > ' + e.error);
  	});

  	serial.getDevices(function(ports) {

  		  console.log('getDevices callback > ports:' + ports.length);

  		  var found_serial = false;

  			for (var i = 0; i < ports.length; i++) {

  			  if (ports[i].path == serial_path) {

  			      	// serial.connect(string path, ConnectionOptions options, function callback)
              	serial.connect(serial_path, {bitrate: 115200 /*,  receiveTimeout: 10000, sendTimeout: 10000 */}, function(e) {
              	  console.log('serial.connect ' + e.connectionId + ' > Ok');
              	  serial_ID = e.connectionId;
              	  // serial.flush(connectionId, function callback);
              	  serial_connected = true;

              	  // TODO : setTimeout(); ?
              	  serialWriteString('v');
              	});

              	return;
  			  }
  			}

        text_console.log('*ERROR* : No serial path ' + serial_path + ' in ' + ports + ' ' + ports.length);
  			console.error('No serial path : ' + serial_path + ' in ' + ports + ' ' + ports.length);
  			console.log(ports);
  			for (var i = 0; i < ports.length; i++) {
  			  console.log(i + ':' + ports[i].path + ' ' + ports[i]);
  			}
		});
  	// serial.send(integer connectionId, ArrayBuffer data, function callback)
});


if (chrome && chrome.app && chrome.app.window) {
chrome.app.window.onClosed.addListener(function() {

  console.log('window.onClosed > serial.disconnect > Ok')

  if (serial_connected) {
    serial.disconnect(serial_ID, function () {
      console.log('onClosed > serial.disconnect > Ok');
      serial_connected = false;
    })
  }
});
}
else {
  window.addEventListener("close", function() {

  console.log('window.close > serial.disconnect > Ok')

  if (serial_connected) {
    serial.disconnect(serial_ID, function () {
      console.log('close > serial.disconnect > Ok');
      serial_connected = false;
    })
  }
});
}

var stringToArrayBuffer = function(s) {

  // TODO : UTF8 chars for multi-octet ?
	var arrayBuffer = new ArrayBuffer(s.length);
	var u8view = new Uint8Array(arrayBuffer);
	for (var i = 0 ; i < s.length ; i++) {
		u8view[i] = s.charCodeAt(i);
	}
	return arrayBuffer;
}

var arrayBufferToString = function(arrayBuffer) {

  var u8view = new Uint8Array(arrayBuffer);
	var string = '';
	for (var i = 0 ; i <arrayBuffer.byteLength ; i++) {
		string += String.fromCharCode(u8view[i]);
	}
	return string;
}


var OBCI = {
  FRAME_LENGTH: 33,
  BEGIN_STREAMING : 'b',
  STOP_STREAMING : 's',
  RESET_CHANNELS: 'd',
  GET_CHAN_STATE: 'D',
  GET_SETTINGS: '?',
  RESET: 'v'
}

// WORKER

// var worker = new Worker('bciWorker.js');
// chrome doesn't allow to call a Worker from File:// so do a little workaround, load it from blob URL
var worker = new Worker(window.URL.createObjectURL(new Blob([document.getElementById('bci_worker').textContent], { type: "text/javascript" })));

worker.onmessage = function(e) {

      if (e.data.length === 8) { // ??? e.data instanceof Array ?

         // if (performance_frame_count % 50 == 0) {
              ui_frame_count.textContent = performance_frame_count++;
              ui_fps.textContent = (1000 * performance_frame_count / (performance.now() - performance_start_time)).toFixed(2);
        //}

        onBciProcess(e.data);
      }

      else if (e.data.slice) { // ??? e.data instanceof Blob ?

        console.log('save to file');

      /*
       // FIXME : @see http://stackoverflow.com/questions/20747234/download-file-from-filesystem-in-google-chrome-solved

        var errorHandler = function(e) { console.error(e); };

         chrome.fileSystem.chooseEntry({type: 'saveFile'}, function(writableFileEntry) {
          writableFileEntry.createWriter(function(writer) {
            writer.onerror = errorHandler;
            writer.onwriteend = function(e) {
              console.log('write complete');
            };
            writer.write(e.data, {type: 'application/octet-binary'});
          }, errorHandler);
        }); */

        var filename = 'braindata1.txt'; // TODO dynamic filename, date, etc
        var link = document.getElementById("save");
        link.href = window.URL.createObjectURL(e.data);
        link.textContent = filename;
        link.download = filename;
      }
}


// UI

var ui_fps,
    ui_frame_count,
    ui_frame_miss;

var performance_frame_count, performance_start_time;

var anim_frame_request; // requestAnimationFrame ID
var controls = [
  {
    caption: 'Start',
    action: function() {
      console.log('start > ');
      serialWriteString(OBCI.BEGIN_STREAMING);

      performance_frame_count = 0;
      performance_start_time = performance.now();

       //  window.setInterval(function() { bci_plot.redraw(); }, 500);

      function step(timestamp) {

        bci_plot.redraw();

        anim_frame_request = window.requestAnimationFrame(step);
      }
      anim_frame_request = window.requestAnimationFrame(step);
    },
    reaction: function(e) {
  	  // console.log('stream dispatcher ' + e.connectionId + ' > ' + e.data.byteLength );
  	  worker.postMessage(e.data);
    }
  },
  {
    caption: 'Stop',
    action: function() {
      console.log('stop > ');
      serialWriteString(OBCI.STOP_STREAMING);

      window.cancelAnimationFrame(anim_frame_request);
    },
    reaction: function(e) {
  	   // console.log('stop stream dispatcher ' + e.connectionId + ' > ' + e.data.byteLength );
  	   worker.postMessage(e.data);
  	  // TODO : worker.postMessage({action: 'stop_pending'});
  	  // TODO : on $$$ enable panel or start button, set default dispatcher
    }
  },
  {
    caption: 'Reset channels',
    action: function() {
      console.log('reset channels > ');
      serialWriteString(OBCI.RESET_CHANNELS);
    },
    reaction: defaultDispatcher
  },
  {
    caption: 'Get channels',
    action: function() {
      console.log('get channels > ');
      serialWriteString(OBCI.GET_CHAN_STATE);
    },
    reaction: function(e) {
      var string = arrayBufferToString(e.data);
      text_console.log(string);
  	  console.log('get channel dispatcher ' + e.connectionId + ' > ' + string.length + ' ' + string );
  	  // TODO : on $$$ set defaultDispatcher ? decoder  (function* return) ? timeout ?
    }
  },
  {
    caption: 'Get settings',
    action: function() {
      console.log('Get settings > ');
      serialWriteString(OBCI.GET_SETTINGS);
    },
    reaction:  function(e) {
      var string = arrayBufferToString(e.data);
      text_console.log(string);
  	  console.log('get settings dispatcher ' + e.connectionId + ' > ' + string.length + ' ' + string );
  	  // TODO : on $$$ set defaultDispatcher ? decoder (function* return) ? timeout ?
    }
  },
  // TODO : checkbox set buffering = true / false ; checkbox stream to server by websocket
  {
    caption: 'Save to file',
    action: function() {
      console.log('Save to file > ');
      worker.postMessage({action: 'export'});
    }
  },
  {
    caption: 'Clear buffer',
    action: function() {
      console.log('clear > ');
      worker.postMessage({action: 'clear'});
    }
  }
];

var addButton = function(task, container) {

  var button = document.createElement('button');
  button.appendChild(document.createTextNode(task.caption));
    if (task.reaction) {
    button.addEventListener('click', function() {

      serialDispatcher = task.reaction;

       // task.reaction.send(); // reset generator function
       // setTimeout( ) ? setTimeout on serial ?

    });
  }
  if (task.action) {
    button.addEventListener('click', task.action);
  }
  container.appendChild(button);
};








