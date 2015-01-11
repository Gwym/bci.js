// driver for OpenBCI board, see http://www.openbci.com/

"use strict"

var SerialPort = require("serialport");

// list ports
/*

// DOESN'T WORK : throws EINT ERROR

SerialPort.list(function (err, ports) {

  if (err) {
    console.log('list > ' + err);
    console.log(err);
    console.log('list > ports:' + ports);
  }
  else {
    ports.forEach(function(port) {
      console.log(port.comName);
      console.log(port.pnpId);
      console.log(port.manufacturer);
    });
  }
});*/

// TODO (1) : autoopen on start or autostart on open ?

module.exports.factory = function(identifier, options, dispatcher) {

  if (options.use_simulator) {
    SerialPort = require('../tests/serialsimulator.js');
  }

  if (!dispatcher) {
    console.warn('obci_serial > No dispatcher defined in options');
    dispatcher = function(state) { console.log('state : ' + state); };
  }

  var port = options.port || '/dev/ttyUSB0';
  var baudrate = options.baudrate || 115200;

  var serialPort;
  var pending_control = false;

  var board = {
    open: function() {
      serialPort.open (function(err) {
          console.log('open callback err: ' + err + ' ' + typeof err);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err.message});
            machine.event('EVENT_ERROR', err);
          }
          else {
            machine.event('EVENT_OPEN');
          }
      });
    },
    close: function() {
      serialPort.close (function(err) {
          console.log('close callback err: ' + err);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
          }
      });
    },
    send: function(c) {
      if (pending_control || c === 's' || c === 'b') {
        return false; // TODO (3) : reply error
      }
      pending_control = c;
      serialPort.write(c, function(err, results) {
          console.log('send '+ c + ' callback err: ' + err + ' results ' + results);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
          }
      });
    },
    startStream: function() {
      serialPort.parse_control = false;
      serialPort.parse_frame = true;
      pending_control = 'b';
      serialPort.write('b', function(err, results) {
        console.log('write b callback err: ' + err + ' results ' + results);
        if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
        }
      });
    },
    stopStream: function() {
      serialPort.parse_control = true;
      pending_control = 's';
      serialPort.write('s', function(err, results) {
          console.log('write s callback err: ' + err + ' results ' + results);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
          }
      });
    },
    reset: function() {
      serialPort.parse_frame = false;
      serialPort.parse_control = true;
      pending_control = 'v';
      serialPort.write('v', function(err, results) {
        console.log('write v callback err:' + err + ' results ' + results);
        if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
        }
      });
    },
    listen: function() {
      serialPort.parse_frame = false;
      serialPort.parse_control = true;
      pending_control = false;
    }
  }

  // TODO (4) : manage EVENT_ERROR and EVENT_CLOSE in all states ?

  var state_table = {
    'STATE_CLOSED' : {
      'EVENT_INIT': function() {
        board.open();
        machine.setTimer('EVENT_TIMEOUT', 3000);
        return 'STATE_OPENING';
      }
    },
    'STATE_OPENING' : {
      'EVENT_OPEN': function() {
        machine.clearTimer('EVENT_TIMEOUT');
        board.listen();

        // option reset on open
        board.reset();
        machine.setTimer('EVENT_TIMEOUT', 3000);

        // option wait for connecting board ?   machine.setTimer('EVENT_TIMEOUT', 10000); return 'STATE_INIT'; // TODO (1) : option autoreset on open ?    //
        return 'STATE_WAIT_ENDING';
      },
      'EVENT_ERROR': function() {
        machine.clearTimer('EVENT_TIMEOUT');
        return 'STATE_CLOSED';
      },
      'EVENT_TIMEOUT': function() {
        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });
        board.close();
        return 'STATE_CLOSED';
      }
    },
    'STATE_INIT': {
      'EVENT_END_OF_SECTION': function(data) {
        machine.clearTimer('EVENT_TIMEOUT');
        // dispatcher( { target: identifier, action:'onready', control: pending_control, data: data } );
        return 'STATE_IDLE';
      },
      'EVENT_TIMEOUT': function() { // option wait for connecting board
        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });
        board.reset();
        // TODO (1) : if retries counter > 3 EVENT_CLOSE ?
         machine.setTimer('EVENT_CLOSE', 5000);
        return 'STATE_INIT';
      },
      'EVENT_CLOSE' : function() {
        board.close();
        return 'STATE_CLOSED';
      }
    },
    'STATE_IDLE' : {
      'EVENT_STREAM_START': function() {
        board.startStream();
        return 'STATE_STREAMING';
      },
      'EVENT_GET_PUT': function(cmd) {
        board.send(cmd.command);
        return 'STATE_WAIT_ENDING';
      },
      'EVENT_CLOSE' : function() {
        board.close();
        return 'STATE_CLOSED';
      }
    },
    'STATE_STREAMING' : {
      'EVENT_STREAM_STOP': function() {
        board.stopStream();
        machine.setTimer('EVENT_TIMEOUT', 3000);
        return 'STATE_WAIT_ENDING';
      }
    },
    'STATE_WAIT_ENDING': {
      'EVENT_END_OF_SECTION': function(data) {
        machine.clearTimer('EVENT_TIMEOUT');
        if (pending_control !== 's') {
          dispatcher( { target: identifier, action:'oncontrol', control: pending_control, data:data });
        }
        // else { }  // do not send buffer if pending control is 's' (stop stream)

        pending_control = false;
        return 'STATE_IDLE';
      },
      'EVENT_TIMEOUT': function() {
        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });
        board.reset();
        machine.setTimer('EVENT_TIMEOUT', 3000);
        return 'STATE_INIT';
      }
    }
  }

  /*
  // DOESN'T WORK, Object.observe is not consistent on multiple set, and not implemented in firefox

  var machine = {
    state: 'STATE_INIT',
    event: ''
  };

  console.log(state_table);

  Object.observe(machine, function(changes) {

    console.log(changes);

    changes.forEach(function(change) {

      if (change.name === 'event') {
          console.log('event ' + change.object.event + ' state:' + change.object.state);
          if (state_table[change.object.state]) {
            if (state_table[change.object.state][change.object.event]) {
              var new_state = state_table[change.object.state][change.object.event](change.object.event);
              console.log('new state: ' + new_state);
            }
            else {
              console.error({ error: 'UNCAUGHT_EVENT', value: change.object.event});
            }
          }
          else {
            console.error({ error: 'UNKNOWN_STATE', value: change.object.state});
          }
      }
      else if (change.name === 'state') {
        console.log(' state:' + change.object.state);
      }
      else {
        console.error({ error: 'UNKNOWN_CHANGE', value: change});
      }
    });
  }); */

  var machine = {
    timers: [],
  	_state: 'STATE_CLOSED',
  	get state () {
  		return this._state;
  	},
  	set state(new_state) {

  	  if (state_table[new_state] === undefined) {
  	    console.warn({ error: 'UNKNOWN_STATE', state: new_state});
  	    return;
  	  }
  	  console.log('set state ' +  this._state + ' >> ' + new_state);
  	  dispatcher( { target: identifier, action: 'onstate', data: { state: new_state, old_state: this._state } } ); // is old_state really usefull ?

  		this._state = new_state;
  	},
  	event: function(e, data) {

  	  console.log('{event:' + e + ' data: ' + data + '}');

  	  if (state_table[this._state][e] === undefined) {
  	    console.error({ error: 'UNKNOWN_EVENT', event: e, state: this._state});
  	    return;
  	  }

  	  var new_state = state_table[this._state][e](data);
  	  if (new_state !== undefined) {
  	    this.state = new_state;
  	  }
  	},
  	setTimer: function(e, duration) {
  	  // TODO : reset existing or duplicate ?
  	  this.timers[e] = setTimeout(function() { machine.event(e); }, duration);
  	},
  	clearTimer: function(e) {
  	  if (this.timers[e] !== undefined) {
  	    clearTimeout(this.timers[e]);
  	  }
  	  else {
  	    console.error({ error: 'UNKNOWN_TIMER', event: e});
  	  }
  	}
  };



  var obci_parser = function () {

    // control parser
    var control_buffer = new Buffer(0),
        control_buffer_offset = 0,
        pattern = ['$'.charCodeAt(0), '$'.charCodeAt(0), '$'.charCodeAt(0)], // '$$$',
        pattern_offset = 0;

    // frame parser
    var LIMIT = 512;
    var FRAME_LENGTH = 33;
    var END_OFFSET = FRAME_LENGTH - 2; // -1 (START is shifted) ; -1 (zero indexed)

    var buf = [];
    var samples = [];
    var accel = [];
    var frame_count = 0;

    return function(emitter, buffer) {

      // console.log('PARSER emitter ' + emitter + ' buffer ' + buffer + ' parse_control:' + emitter.parse_control + ' parse_frame:' + emitter.parse_frame );

      if (emitter.parse_control) {

        control_buffer = Buffer.concat([control_buffer, buffer], control_buffer.length + buffer.length);

        if (pattern.length) {
          while (control_buffer_offset < control_buffer.length) {

             // checker.next(this.buffer[this.offset])
            if (control_buffer[control_buffer_offset] === pattern[pattern_offset]) {

              // console.log('match ' + pattern[pattern_offset] + ' ' + control_buffer[control_buffer_offset] + ' @ ' + control_buffer_offset + ' ' + pattern_offset);
              if (++pattern_offset >= pattern.length) {

                machine.event('EVENT_END_OF_SECTION', (control_buffer.slice(0, control_buffer_offset - pattern.length + 1)).toString());

                control_buffer = control_buffer.slice(control_buffer_offset, control_buffer.length); // continue at the begining
                control_buffer_offset = 0;
                pattern_offset = 0;
              }
            }
            else {
              // console.log('reset pattern ' + pattern[pattern_offset] + ' ' + control_buffer[control_buffer_offset] + ' @ ' + control_buffer_offset + ' ' + pattern_offset);
              pattern_offset = 0;
            }
            control_buffer_offset++;
          }
        }
      }


      if (emitter.parse_frame) {


          for (var i = 0 ; i < buffer.length ; i++) {
            buf.push(buffer[i]);
          }

          if (buf.length > LIMIT) {
            // this.postMessage({error: 'No frame decoded, discarding whole buffer.', length: buf.length });
            console.log("{error: 'No frame decoded, discarding whole buffer.', length: buf.length }");
            buf = [];
            return;
          }

          var current_byte, current_frame_counter, d, j, i;

          while (buf.length > FRAME_LENGTH) {

            current_byte = buf.shift();

            if (current_byte === 0xA0) {
              if (buf[END_OFFSET] === 0xC0) { // FRAME_LENGTH - 2

                d = buf.splice(0, FRAME_LENGTH - 1);

                current_frame_counter = d[0];

                i = 1;
                for (j = 0 ; j < 8 ; j++) {
                  // 24 to 32
                  samples[j] = d[i++] << 16 |  d[i++] << 8 | d[i++];
                  if (samples[j] > 0x7FFFFF) {
                    samples[j] -= 0x1000000;
                  }
                }
                for (j = 0 ; j < 3 ; j++) {
                  // 16 to 32
                  accel[j] = d[i++] << 8 | d[i++];
                  if (accel[j] > 0x7FFF) {
                    accel[j] -= 0x10000;
                  }
                }

                frame_count++;
                // emitter.emit('frame', {samples: samples, accel: accel}); emit 'data' ?
                dispatcher( { target: identifier, action:'ondata', data: { samples: samples, accel: accel, count: current_frame_counter } } );
              }
              else {
                // this.postMessage({ error: 'start not matching stop', len: buf.length, char: buf[END_OFFSET] });
                console.log("{ error: 'start not matching stop', len: buf.length, char: buf[END_OFFSET] }");
              }
            }
            else {
              // this.postMessage({ error: 'drop one byte', byte: current_byte });
              // console.log("{ error: 'drop one byte', byte: current_byte }");
            }
          } // end while
      }
    }
  }



  try {

    console.log('SERIAL PORT ' + SerialPort);

     serialPort = new SerialPort.SerialPort(port, {
      baudrate: baudrate,
      parser: obci_parser()
    },
    false ); // false : do not open immediately

    serialPort.on("error", function (err) {
      console.log('onerror ' + err);
      machine.event('EVENT_ERROR', err);
    });

    // serial.setMaxListeners('frame', 10); // node.js default
    // serial.setMaxListeners('control', 10); // node.js default

  } catch (e) {
      // Error means port is not available for listening.
      console.log('catch ' + e);
      machine.event('EVENT_ERROR', {type: 'NO SERIAL PORT'});
  }

  // api exposed to clients
  var api = {

    open: function(m, ws) { // TODO : if (busy) -> return if state != ? or managed in event machine, unknown event ?
      console.log('SERIAL open');
      machine.event('EVENT_INIT');
    },
    close: function(m, ws) {
      console.log('SERIAL close');
      machine.event('EVENT_CLOSE');
    },
    start: function(m, ws) {
      console.log('SERIAL start stream');
      machine.event('EVENT_STREAM_START');
    },
    stop: function(m, ws) {
      console.log('SERIAL stop stream');
      machine.event('EVENT_STREAM_STOP');
    },
    req_set: function(m, ws) {
      console.log('SERIAL get req');
      machine.event('EVENT_GET_PUT'); // TODO (0) : m
    },
    getState: function() {
      return machine.state;
    }
  }

  return api;
}