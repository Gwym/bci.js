
// var force_simulator = true;
var force_simulator = false;

// Serial simulator, for testing and debugging

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

var debug_frame_ms = 8; // send a frame every ... ms : 9ms ~ 250 fps from board

var DEBUG_START = 0;
var DEBUG_COUNT = DEBUG_START + 1;
var DEBUG_END = DEBUG_START + 32;

var debugSinGen = sinIter(0);

var SerialSimulator = {

  path: 'SerialSimulator',
  onReceive: {
    addListener: function(callback) {
      SerialSimulator.onReceiveCallback = callback;
    }
  },
  onReceiveError: {
    addListener: function(callback) {
      SerialSimulator.onReceiveErrorCallback = callback;
    }
  },
  getDevices: function(callback) {
    callback([{path:'/dev/ttyUSB0'}]);
  },
  connect: function(path, options, callback) {
    callback({connectionId: 0});
    // SerialSimulator.init();
  },
  send: function(id, data, callback) {

    callback({bytesSent: data.byteLength});

    var cmd = arrayBufferToString(data);

    switch (cmd) {
      case OBCI.RESET:
        SerialSimulator.init();
        break;
      case OBCI.RESET_CHANNELS:
        // no ACK ?
        break;
      case OBCI.GET_CHAN_STATE:
        SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('123456')});
        SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('$$$')});
        break;
      case OBCI.GET_SETTINGS:
        SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('0x010x020x03')});
        SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('$$$')});
        break;
      case OBCI.BEGIN_STREAMING:
       SerialSimulator.interval_ID = window.setInterval(function() {

          for (var k = 0 ; k < 10 ; k++) {
            var length = 10;
            var dataBuffer = new ArrayBuffer(length);
            var u8view = new Uint8Array(dataBuffer);

            for (var i = 0 ; i < length ; i++) {
               u8view[i] = debugSinGen.next().value;
            }

            SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: dataBuffer});

              //  on end : SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('$$$')});

          } // end for k

          }, debug_frame_ms);
        break;
      case OBCI.STOP_STREAMING:
        window.clearInterval(SerialSimulator.interval_ID);
        break;

    }

  },
  disconnect: function(id, callback) {
    callback();
  },

  init: function() {
       window.setTimeout(function() {

      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('OpenBCI V3')});
      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('32bit Boar')});
      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('d\nSetting ADS1299 Channel Values\n')});
      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('ADS1299 Device ID: 0x3D ')});
      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer('LIS3DH Device ID')});
      SerialSimulator.onReceiveCallback({connectionId: serial_ID, data: stringToArrayBuffer(': 0x11 $$$')});

    },
    1000);
  }

};




var testSetArrayOverflow = function() {

  console.log('TEST > testSetArrayOverflow');
  var source = new Uint8Array(10);
  for (var i = 0 ; i < 10 ; i++) {
    source[i] = i;
  }
  var destination = new Uint8Array(33);
  console.log(source);
  console.log(destination);
  var sub = source.subarray(7,10);
  console.log(sub);
  destination.set(sub, 30); // throws RangeError: Source is too large
  console.log(destination);
  console.assert(destination.length === 33);

};

        // m : msb, o: lsb
var s24Tos32 = function (m, n, o) {

      o |= n << 8 | m << 16;

      return o > 0x7FFFFF ? o - 0x1000000 : o ;
}

    // m: msb, l : lsb
var s16Tos32 = function(m, l) {

      l |= m << 8;

      return l > 0x7FFF ? l - 0x10000 : l ;
}
