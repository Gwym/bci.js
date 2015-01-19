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
  var pending_write = [];
  var writing = false;

  if (options.log_control) {
    var log_stream;
  }

  var board = {
    open: function() {
      serialPort.open (function(err) {
          console.log('open callback err: ' + err + ' ' + typeof err);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err.message});
            machine.event('EVENT_ERROR', err);
          }
          else {
            // log
            if (options.log_control) {
              var d = new Date();
              var filename = 'logs/log_c_' + d.getFullYear() + '-' + (d.getMonth()+1) + '-' +  d.getDate() + '-' +
                d.getHours()  + '-' +  d.getMinutes() + '-' + d.getSeconds() + '_' + d.getMilliseconds() + '.log';
              console.log('log control to ' + filename);
              log_stream = require('fs').createWriteStream(filename);

              log_stream.on('error', function (err) {
                options.log_control = false;
                console.error(err);
                dispatcher( { target: identifier, action:'onerror', data: err.message});
              });
            }

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

      if (options.log_control) {
        log_stream.end();
      }

    },
    feed: function(c) {

      console.log('board.feed >' +  c + ' (' + typeof c + ') isArray :' + (c instanceof Array));

      if (typeof c === 'number') {
        pending_write.push(c); // assume this is the charcode
      }
      else if (typeof c === 'string') {
        for (var i = 0 ; i < c.length ; i++) {
          pending_write.push(c[i]);
        }
      }
      else if (c instanceof Array) {
        pending_write = pending_write.concat(c);
      }
      else {
        var err = new Error('board.feed > unknown type');
        console.error(err);
        dispatcher( { target: identifier, action:'onerror', data: err });
        machine.event('EVENT_ERROR', err);
      }
    },
    // return false if there is no more character to send or true if
    sendNext: function() {

      var c = pending_write.shift();

      if (c === undefined) { // end of transmission
        console.log('sendNext > End of transmission');
        return false;
      }

      if ( typeof c !== 'string' || c.length !== 1 || c === 's' || c === 'b') { // TODO (2) : check this in feed directly ?
        console.error('sendNext > Error : use api for command ' + c + ' ' + typeof c ); // TODO (3) : reply error to websocket
        return false;
      }

      var d = new Date();
      console.log(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' > SEND NEXT ' + c);

      if (options.log_control) {
          log_stream.write(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' >>> ' + c + '\r\n');
          // log_stream.write(process.hrtime() + c + '\r\n');
      }

      serialPort.write(c, function(err, results) {
          console.log('sendNext > '+ c + ' callback err: ' + err + ' results ' + JSON.stringify(results));
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
          }
      });

      return true; // TODO (1) : should be async, in case of write err (EVENT_WRITTEN ?)
    },
    startStream: function() {
      serialPort.parse_control = false;
      serialPort.parse_frame = true;
      serialPort.write('b', function(err, results) {
        console.log('startStream > Write b callback err: ' + err + ' results ' + results);
        if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
        }
      });
    },
    stopStream: function() {
      serialPort.parse_control = true;
      serialPort.write('s', function(err, results) {
          console.log('stopStream > Write s callback err: ' + err + ' results ' + results);
          if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
          }
          else {
            console.log('sent s (stop)');
            dispatcher( { target: identifier, action:'oncontrol', data: { control:'stop' } });
          }
      });
    },
    reset: function() {
      serialPort.parse_frame = false;
      serialPort.parse_control = true;
      serialPort.write('v', function(err, results) {
        console.log('reset > Write v callback err:' + err + ' results ' + results);
        if (err) {
            dispatcher( { target: identifier, action:'onerror', data: err });
            machine.event('EVENT_ERROR', err);
        }
      });
    },
    listen: function() {
      serialPort.parse_frame = false;
      serialPort.parse_control = true;
    }
  }

  // TODO (4) : manage EVENT_ERROR and EVENT_CLOSE in all states +  user.option.reset_board_on_error ?

  var state_table = {
    'STATE_CLOSED' : {
      'EVENT_INIT': function() {
        board.open();
        machine.setTimer('EVENT_TIMEOUT', 3000); // 3s
        return 'STATE_OPENING';
      }
    },
    'STATE_OPENING' : { // serial port opening
      'EVENT_OPEN': function() {
        machine.clearTimer('EVENT_TIMEOUT');
        board.listen();

        var option_reset_board_on_opening = true; // TODO (3) : user.options.reset_board_on_opening

        if (option_reset_board_on_opening) {
          board.reset();
          // machine.setTimer('EVENT_TIMEOUT', 3000);
          // return 'STATE_WAIT_ENDING';
        }
        else { // option wait for board to be turned on by user
          // machine.setTimer('EVENT_TIMEOUT', 20000); // 20s
          // dispatcher( { target: identifier, action: 'onstate', data: { waiting_for_eot: true } } );
          // return 'STATE_INIT';
        }
        return 'STATE_IDLE';
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
    'STATE_INIT': { // waiting board to be turned on
      'EVENT_END_OF_SECTION': function(data) {
        machine.clearTimer('EVENT_TIMEOUT');
        return 'STATE_IDLE';
      },
      'EVENT_GET_PUT': function(cmd) {  // event for !option.reset_board_on_opening, TODO (3) : limit to command reset 'v' ?
        machine.clearTimer('EVENT_TIMEOUT');
        machine.setTimer('EVENT_TIMEOUT', 5000);
        board.feed(cmd);
        board.sendNext();
        return 'STATE_INIT';
      },
     /* 'EVENT_TIMEOUT': function() { // option wait for connecting board and waiting for v reset // done client side now !

        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });
        board.reset();
        // TODO (1) : if retries counter > 3 EVENT_CLOSE ?
        machine.setTimer('EVENT_CLOSE', 5000); // 5s
        return 'STATE_INIT';
      }, */
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

        board.feed(cmd);
        if (!writing) {

        var d = new Date();
        console.log(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' > GET PUT ' + cmd);

          // dispatcher( { target: identifier, action: 'onstate', data: { writing: true } } );
          machine.setTimer('EVENT_WRITE_NEXT', 20); // trigger first send event
        }

        return 'STATE_IDLE';
      },
      'EVENT_CONTROL': function(data) {

        // machine.clearTimer('EVENT_TIMEOUT');
        dispatcher( { target: identifier, action:'oncontrol', data: data });

        return 'STATE_IDLE';
      },
      'EVENT_WRITE_NEXT': function() {

        writing = board.sendNext();

        if (writing) {
          machine.setTimer('EVENT_WRITE_NEXT', 100); // trigger next send event
        }
        // else { dispatcher( { target: identifier, action: 'onstate', data: { writing: false } } ); }

        return 'STATE_IDLE';
      },
      'EVENT_TIMEOUT': function() {

        // TODO (0) : send and reset control_buffer ?
        // dispatcher( { target: identifier, action: 'onstate', data: { waiting_for_eot: false } } );
        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });

        return 'STATE_IDLE';
      },
      'EVENT_ERROR' : function(err) {

        dispatcher( { target: identifier, action:'onerror', data: err });
        board.close();

        return 'STATE_CLOSED';
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
        dispatcher( { target: identifier, action:'oncontrol', data: data });

        return 'STATE_IDLE';
      },
      'EVENT_TIMEOUT': function() {

        // TODO (0) : send and reset control_buffer ?
        dispatcher( { target: identifier, action:'onerror', data: 'timeout' });
        // TODO (3) : user.option.reset_board_on_timeout
        /* board.reset();
        machine.setTimer('EVENT_TIMEOUT', 3000);
        return 'STATE_INIT'; */
        return 'STATE_IDLE'; // do not reset + timeout, it's the user choice to reset or not
      }
    }
  }

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

  	  if (this._state !== new_state) {
  	    // console.log('set state ' +  this._state + ' >> ' + new_state);
  	    dispatcher( { target: identifier, action: 'onstate', data: { state: new_state, old_state: this._state } } ); // is old_state really usefull ?
    		this._state = new_state;
  	  }
  	},
  	event: function(e, data) {

      var d = new Date();
  	  // console.log(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' > event:' + e + ' data: ' + (typeof data === 'string' ? data.replace(/\r/gm,'\\r').replace(/\n/gm,'\\n') : data));

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
  	  // TODO (3) : reset existing or duplicate ?
  	  if (this.timers[e]) {
  	    console.error('setTimer > Error : timer already set ' + e);
  	    throw new Error(' timer already set'); // return;
  	  }
  	  this.timers[e] = setTimeout(function() { delete machine.timers[e]; machine.event(e); }, duration);
  	},
  	clearTimer: function(e) {

  	  if (this.timers[e] !== undefined) {
  	    clearTimeout(this.timers[e]);
  	    delete this.timers[e];
  	    console.log('TIMERS > Clear timer ' + e + ' ' + this.timers);
  	  }
  	  else {
  	    console.error({ error: 'UNKNOWN_TIMER', event: e});
  	  }
  	}
  };



  var obci_parser = function () {

    // control parser
    var // control_buffer = new Buffer(0),
        // control_buffer_offset = 0,
        control_string = '',
        //pattern = ['$'.charCodeAt(0), '$'.charCodeAt(0), '$'.charCodeAt(0)], // '$$$',
        pattern_crlf = '\r\n',
        pattern_eot = '$$$';
       // pattern_offset = 0;

    // frame parser
    var LIMIT = 512;
    var FRAME_LENGTH = 33;
    var END_OFFSET = FRAME_LENGTH - 2; // -1 (START is shifted) ; -1 (zero indexed)

    var buf = [];
    var samples = [];
    var accel = [];
    var frame_count = 0;

    var timestamp_start = process.hrtime();



    return function(emitter, buffer) {

      var timestamp_step = process.hrtime(timestamp_start);
      timestamp_start =  process.hrtime();
      // console.log(timestamp_step + ' obci_parser > len:' + buffer.length + ' parse_control:' + emitter.parse_control + ' parse_frame:' + emitter.parse_frame );

      if (emitter.parse_control) {

        machine.event('EVENT_CONTROL', buffer.toString());

        if (options.log_control) {
          var d = new Date();
  	      //console.log(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' > event:' + e + ' data: ' + (typeof data === 'string' ? data.replace(/\r/gm,'\\r').replace(/\n/gm,'\\n') : data));
          log_stream.write(d.toLocaleTimeString() + ':' + d.getMilliseconds() + ' < ' + buffer.toString().replace(/\r/gm,'\\r').replace(/\n/gm,'\\n') + '\r\n');
          // log_stream.write(process.hrtime() + buffer.toString() + '\r\n');
          // log_stream.write(buffer.toString());
          // log_stream.write(buffer.toJSON());
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
      console.log('SERIAL get req ' + m);
    /*  if (['?', 'd', 'D', 'v'].indexOf(m) !== -1) {
        machine.event('EVENT_GET_PUT', m);
      }
      else {
       console.error('SerialPort.api > res_set unallowed command ' + JSON.stringify(m));
       // TODO (0) : reply error
      } */
      machine.event('EVENT_GET_PUT', m);
    },
    getState: function() {
      return machine.state;
    }
  }

  return api;
}