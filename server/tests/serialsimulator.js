

var util = require('util');
var stream = require('stream');

// Serial simulator, for testing and debugging

var simulate_open_error = false;
var simulate_board_silence = false;


function* sinIter(phase) {

    var phi = phase || 0,
        counter = 0,
        value, i,
        buffer = new ArrayBuffer(4),
        dv = new DataView(buffer);

    while(true) {
      yield 0xA0; // start
      yield counter++;
      if (counter > 255)
        counter = 0;
      // channels : 8 * 24 bits
      for (i = 0 ; i < 8 ; i++) {

       // value = Math.floor((Math.random() * 2 - 1) * 0x7FFFFF);
       // value = Math.floor(Math.sin(phi / 12) * 0x7FFFFF);
       value = Math.floor((Math.sin(phi / 12) + Math.sin(phi)) / 2 * 0x7FFFFF);

        // dataview.setInt32(byteOffset, value , littleEndian); force big endian to be consistent with board chip (???)
        dv.setInt32(0, value, false);
        yield dv.getUint8(1);
        yield dv.getUint8(2);
        yield dv.getUint8(3);
      //    yield 0x80;
      //    yield 0x00;
      //    yield 0x00;
      }
      // accel x y z 16 bits
      for (i = 0 ; i < 3 ; i++) {

        yield Math.floor(Math.random() * 0xFF);
        yield Math.floor(Math.random() * 0xFF);
      }
      yield 0xC0;
      phi++;
    }
}

var debug_frame_counter = 0;
var debug_frame_offset = 0;

var debug_frame_ms = 10; // send a frame every ... ms  ~ 250 fps from board


var debugSinGen = sinIter(0);

var obci_parser;


var interval_ID;

var SerialSimulator = function(port, options, openImmediate) {
  console.log('SerialSimulator > Create ' + port + ' ' + options);
  if (typeof options.framerate === 'number') {
    console.log('SerialSimulator > set framerate to ' + options.framerate);
    debug_frame_ms = options.framerate;
  }
  if (openImmediate) {
    // TODO (5) ?
  }

  obci_parser = options.parser;
};

util.inherits(SerialSimulator, stream.Stream);

SerialSimulator.prototype.open = function(callback) {
    console.log('SIMULATOR > OPEN');
    var self = this;
    setTimeout(function() {
      if (simulate_open_error) {
        callback(new Error('test error'));
      }
      else {
        callback();
      }
    }, 0);
};

SerialSimulator.prototype.close = function(callback) {
    console.log('SIMULATOR > CLOSE');
    var self = this;
    setTimeout(function() {
      callback();
      // callback(new Error('test error'));
    }, 0);};

SerialSimulator.prototype.write = function(s, callback) {
    console.log('SIMULATOR > WRITE ' + s);

    /* if (!Buffer.isBuffer(buffer)) {
      buffer = new Buffer(buffer);
    }*/

    var self = this;

    var cmd = s; // arrayBufferToString(data);

    switch (cmd) {
      case 'v':

        if (!simulate_board_silence) {

        setTimeout(function() {

          console.log('SIMULATOR > SEND INIT ' + self);

          obci_parser(self, new Buffer('OpenBCI V3'));
          obci_parser(self, new Buffer('OpenBCI V3'));
          obci_parser(self, new Buffer('32bit Boar'));
          obci_parser(self, new Buffer('d\nSetting ADS1299 Channel Values\n'));
          obci_parser(self, new Buffer('ADS1299 Device ID: 0x3D '));
          obci_parser(self, new Buffer('LIS3DH Device ID'));
          obci_parser(self, new Buffer(': 0x11 $$$'));
        },
        500);
        }
        break;
      case 'b':
       interval_ID = setInterval(function() {

          // console.log('SIMULATOR > send data');

          for (var k = 0 ; k < 10 ; k++) {
            var length = 10;
            var dataBuffer = new Buffer(length);

            for (var i = 0 ; i < length ; i++) {
               dataBuffer[i] = debugSinGen.next().value;
            }

            // self.emit('data', dataBuffer);
            obci_parser(self, dataBuffer);

              //  on end : '$$$'

           } // end for k

          }, debug_frame_ms);
        break;
      case 's':
        setTimeout(function() {
          clearInterval(interval_ID); // TODO (4) : stop cleanly on frame end
          // self.emit('data', new Buffer('$$$'));
           obci_parser(self, new Buffer('$$$'));
        }, 2000);
        break;

    }

    setTimeout(function() { callback(null, {bytesSent: s.length});  }, 0);

};

var SerialPort = {
  SerialPort: SerialSimulator
}

module.exports = SerialPort;