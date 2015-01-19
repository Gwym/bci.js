var ui_serial = function(identifier, options) {

  console.log('options');
  console.log(options);


  var performance_frame_count, performance_start_time;
  var fps, frame_count, frame_miss;
  var control_string = '';
  var control_timeout_ID;

  var open_close_button, start_stop_button, reset_board_button, board_state, board_error;
  var board_settings, board_settings_button, bsb_get, bsb_get_registers, bsb_set, bsb_reset, bsb_cancel;

  var open_handler = function() { // TODO (3) : generic function(e) { var btn = e.target; btn.disabled = true; postMessage data: btn.data ... if ( btn.anim !== undefined  ) reg/unreg... } ?

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

      e = document.createElement('span');
      e.id = 'device_ID_' + identifier;
      o.appendChild(e);

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
      open_close_button.className = 'serial_button';
      open_close_button.type = 'button';
      e.appendChild(open_close_button);

      start_stop_button = document.createElement('input');
      start_stop_button.className = 'serial_button';
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
      board_error.addEventListener('click', function(e) { board_error.textContent = ''; board_error.style.display = 'none'; });
      // TODO (0) : when shoul error message be cleard ? on user action ? on board ack ? on reset ?
      e.appendChild(board_error);

      // board settings

      var tbody; // contains the table of settings

      var bs_bindings = {
        setChannelConfiguration: function(config) {

          // TODO (0) : decode ack
          console.log('config');
          console.log(config);

         // TODO (0) : document fragment

          while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
          }

          var tr, t, o;

          // overwrite checkbox.value to have true <=> 1 false <=> 0 strings, to be consistent with select
          var checkbox_getter = function() { return this.checked ? '1' : '0' };
          var checkbox_setter = function(b) { this.checked = b === '0' || !b ? false : true };  // accept number and string 0,1


          for (var c = 0 ; c < 8 ; c++) {

            if (!config[c]) {
              // console.warn('no config for channel ' + c);
              //          [OFF, GAIN, SRC, BIAS, SRB2, SRB1, P, N]
              config[c] = [ 0,   6,    0,   1,    1,    0,   0, 0];
            }

            tr = document.createElement('tr');

            t = document.createElement('td');
            t.textContent = i18n.channels[c];
            tr.appendChild(t);

            t = document.createElement('td');
            o = document.createElement('input');
            o.type = 'checkbox';
            o.checked = config[c][0]; // TODO (2) : o.checked = options.adc_disabled.default (on = 0 off = 1)
            o.onchange = bs_bindings.refreshSetOrCancel; // TODO (2) : event delegation ?
            Object.defineProperty(o, 'value', { get: checkbox_getter, set: checkbox_setter });
            o.original_value = o.value;
            t.appendChild(o);
            tr.appendChild(t);

            t = document.createElement('td');
            var select = document.createElement('select');
            [1,2,4,6,8,12,24].forEach(function(element, index) {
              o = document.createElement('option');
              o.textContent = element;
              o.value = index;
              select.appendChild(o);
            });
            select.selectedIndex = config[c][1]; // TODO (2) :select.selectedIndex = options.adc_gain.default (0 = x1 ... 6 = x24)
            select.onchange = bs_bindings.refreshSetOrCancel;
            select.original_value = select.value;
            t.appendChild(select);
            tr.appendChild(t);


            t = document.createElement('td');
            var select = document.createElement('select');
            i18n.adc_input_type_values.forEach(function(element, index) {
              o = document.createElement('option');
              o.textContent = element;
              o.value = index;
              select.appendChild(o);
            });
            select.selectedIndex = config[c][2]; // TODO (2) :select.selectedIndex = options.adc_input_type'.default (0 = NORMAL)
            select.onchange = bs_bindings.refreshSetOrCancel;
            select.original_value = select.value;
            t.appendChild(select);
            tr.appendChild(t);

            for (var i = 3 ; i < 8; i++) {
              t = document.createElement('td');
              o = document.createElement('input');
              o.type = 'checkbox';
              o.checked = config[c][i];
              o.onchange = bs_bindings.refreshSetOrCancel;
              Object.defineProperty(o, 'value', { get: checkbox_getter, set: checkbox_setter });
              o.original_value = o.value;
              t.appendChild(o);
              tr.appendChild(t);
            }

            tbody.appendChild(tr);
          }
        },
        refreshSetOrCancel: function(e) {

          console.log('onchange refreshSetOrCancel > value: ' + e.target.value + ' checked:' + e.target.checked + ' original_value: ' + e.target.original_value);

          // refresh by looking at all

          var c, i, channels, settings, input, value_changed, channel_str, board_str = '';

          channels = tbody.children; // tr's
          for (c = 0 ; c < channels.length ; c++) { // foreach tr
              settings = channels[c].children; // td's


              // Channel Setting Commands : disabled 1 to SRB1 6
              value_changed = false;
              channel_str = 'x' + (c+1); // channels are 1 based
              for (i = 1 ; i < 7 ; i++) {
                input = settings[i].firstChild;
                if (input.original_value !== input.value) {
                  // console.log('channel ' + c + ' setting ' + i + ' value:' + input.value + ' ' +  typeof input.value  + ' original_value:'  + input.original_value  + ' ' +  typeof  input.original_value );
                  value_changed = true;
                }
                channel_str += input.value;
              }
              if (value_changed) {
                board_str += channel_str + 'X';
              }

              // LeadOff Impedance Commands : 7 & 8
              value_changed = false;
              channel_str = 'z' + (c+1); // channels are 1 based
              for (i = 7 ; i < 9 ; i++) { // skip channel name at 0, disabled 1 to SRB1 6
                input = settings[i].firstChild;
                 if (input.original_value !== input.value) {
                  // console.log('channel ' + c + ' setting ' + i + ' value:' + input.value + ' ' +  typeof input.value  + ' original_value:'  + input.original_value  + ' ' +  typeof  input.original_value );
                  value_changed = true;
                }
                channel_str += input.value;
              }
              if (value_changed) {
                board_str += channel_str + 'Z';
              }
          }
          bs_bindings.settings_string = board_str;
        },
        applySettingsChanges: function() {

          console.log('applySettingsChanges > settings_string:' + bs_bindings.settings_string);

          worker.postMessage({
            action: 'send',
            data: {
              target: identifier,
              action: 'req_set',
              data: bs_bindings.settings_string
          }});

          bs_bindings.settings_string = '';

          // refresh original values // TODO (5) : get state from board to check ?
          var c, i, input, settings, channels = tbody.children; // tr's
          for (c = 0 ; c < channels.length ; c++) { // foreach tr
              settings = channels[c].children; // td's

              for (i = 1 ; i < 9 ; i++) {
                input = settings[i].firstChild;
                if (input.value !== input.original_value) {
                  input.original_value = input.value;
                }
              }
          }
        },
        restoreOriginalSettings: function() {

          console.log('restoreOriginalSettings > settings_string:' + bs_bindings.settings_string);

          bs_bindings.settings_string = '';

          var c, i, input, settings, channels = tbody.children; // tr's
          for (c = 0 ; c < channels.length ; c++) { // foreach tr
              settings = channels[c].children; // td's

              for (i = 1 ; i < 9 ; i++) {
                input = settings[i].firstChild;
                // console.log('channel ' + c + ' setting ' + i + ' value:' + input.value + ' ' +  typeof input.value  + ' original_value:'  + input.original_value  + ' ' +  typeof  input.original_value );
                if (input.value !== input.original_value) {
                  input.value = input.original_value;
                }
              }
          }
        }
      }

      var _settings_string = '';

      Object.defineProperty(bs_bindings, 'settings_string', {
        get: function() {
          return _settings_string;
        },
        set: function(s) {
          console.log('set settings_string = ' + s);
          _settings_string = s;
          if (s.length === 0) {
              bsb_set.settings_virtual_disabled = true; // regardless of board state
              bsb_cancel.disabled = true;
          }
          else {
              bsb_set.settings_virtual_disabled = false;
              bsb_cancel.disabled = false;
          }
        }
      });

      board_settings_button = document.createElement('button');
      board_settings_button.className = 'serial_button';
      board_settings_button.textContent = String.fromCharCode(9881) + ' ' + i18n.board_settings_button;
      board_settings_button.onclick = function() { board_settings.style.display = board_settings.style.display === 'block' ? 'none' : 'block' }; // toggle visibility
      e.appendChild(board_settings_button);

      reset_board_button  = document.createElement('button');
      reset_board_button.className = 'serial_button';
      reset_board_button.textContent = i18n.reset_board;
      reset_board_button.onclick = function() {
        console.log('reset board (v)');
        // reset_board_button.disabled = true;

        // TIODO (3) : add special api for reset insted of generic send v ?
        worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'req_set',
            data: 'v' // TODO (2) : DRY configuration.command.reset_board
          }});

      };  // TODO (4) : spaecial SerialPort.api for reset ?
      e.appendChild(reset_board_button);

      board_settings = document.createElement('div');
      board_settings.style.display = 'none';

      var table = document.createElement('table');
      var caption = document.createElement('caption');
      caption.textContent = i18n.board_settings;

      bsb_get = document.createElement('button');
      bsb_get.className = 'bsb_button';
      bsb_get.textContent = i18n.bsb_get;
      bsb_get.onclick = function() { // TODO (3) : generic function(e) { e.target.disabled = true; postMessage data: e.target.data ... } ?

        console.log('get settings (D)');

      //  bsb_get.disabled = true;
        worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'req_set',
            data: 'D' // TODO (2) : DRY configuration.command.get_channels_settings
          }});
      }
      caption.appendChild(bsb_get);

      bsb_reset = document.createElement('button');
      bsb_reset.className = 'bsb_button';
      bsb_reset.textContent = i18n.bsb_reset;
      bsb_reset.onclick = function() {

        console.log('reset settings (d)');
     //   bsb_reset.disabled = true;
        worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'req_set',
            data: 'd' // TODO (2) : DRY configuration.command.reset_channels_settings
          }});
      }
      caption.appendChild(bsb_reset);

      bsb_set = document.createElement('button');
      bsb_set.className = 'bsb_button bsb_set';
      bsb_set.textContent = i18n.bsb_set;
      bsb_set.onclick = bs_bindings.applySettingsChanges;

      var _board_virtual_disabled = true; // default true, triggered by board opening and settings changes
      var _settings_virtual_disabled = true;

      Object.defineProperty(bsb_set, 'board_virtual_disabled', {
        get: function() { return _board_virtual_disabled },
        set: function(b) {
          console.log('set board_virtual_disabled = ' + b + ', current:' + bsb_set.disabled + ', board_virtual_disabled:' + bsb_set.board_virtual_disabled + ', settings_virtual_disabled:' + bsb_set.settings_virtual_disabled) ;
          _board_virtual_disabled = b;
          bsb_set.disabled = _settings_virtual_disabled || _board_virtual_disabled;
        }
      });

      Object.defineProperty(bsb_set, 'settings_virtual_disabled', {
        get: function() { return _settings_virtual_disabled },
        set: function(b) {
          console.log('set board_virtual_disabled = ' + b + ', current:' + bsb_set.disabled + ', board_virtual_disabled:' + bsb_set.board_virtual_disabled + ', settings_virtual_disabled:' + bsb_set.settings_virtual_disabled) ;
          _settings_virtual_disabled = b
          bsb_set.disabled = _settings_virtual_disabled || _board_virtual_disabled;
        }
      });

      caption.appendChild(bsb_set);

      bsb_cancel = document.createElement('button');
      bsb_cancel.className = 'bsb_button bsb_cancel';
      bsb_cancel.textContent = i18n.bsb_cancel;
      bsb_cancel.disabled = true;
      bsb_cancel.onclick = bs_bindings.restoreOriginalSettings;
      caption.appendChild(bsb_cancel);

      bsb_get_registers = document.createElement('button');
      bsb_get_registers.className = 'bsb_button bsb_get_registers';
      bsb_get_registers.textContent = i18n.bsb_get_registers;
      bsb_get_registers.onclick = function() {

        console.log('get settings (?)');

        //bsb_get_registers.disabled = true;
        worker.postMessage({
          action: 'send',
          data: {
            target: identifier,
            action: 'req_set',
            data: '?' // TODO (2) : DRY configuration.command.get_registers_settings
          }});
      }
      caption.appendChild(bsb_get_registers);

      table.appendChild(caption);
      var thead = document.createElement('thead');
      tbody = document.createElement('tbody');
      tbody.id = 'board_settings_' + identifier;

      bs_bindings.setChannelConfiguration(tbody, []); // set defaut configuration, assuming board was reseted // TODO (4) : always read from board on startup ?

      var tr = document.createElement('tr');
      var o, t;

      ['adc_channel', 'adc_disabled','adc_gain', 'adc_input_type', 'adc_bias', 'adc_SRB2', 'adc_SRB1', 'adc_impedance_p', 'adc_impedance_n'].forEach(function(field) {
        t = document.createElement('th');
        t.textContent = i18n[field];
        if (i18n[field + '_hint']) {
          t.title = i18n[field + '_hint'];
        }
        tr.appendChild(t);
      });

      thead.appendChild(tr);

      table.appendChild(thead);
      table.appendChild(tbody);
      board_settings.appendChild(table);

      e.appendChild(board_settings);

      container.appendChild(e);

  var api = {
    ondata: function(data) {

      frame_count.textContent = performance_frame_count++;
      fps.textContent = (1000 * performance_frame_count / (performance.now() - performance_start_time)).toFixed(2);

      bci_data.feed(data.samples);
      // TODO (1)  : process data.accel
    },
    oncontrol: function(m) {

      // console.log('oncontrol ' + (typeof m) + ' ' + m);

      if (typeof m === 'string') {

        if (control_timeout_ID === undefined) {
          control_timeout_ID = setTimeout(function() {
              control_timeout_ID = undefined;
              board_error.textContent = 'parser error'; // TODO (2) : board_error i18n
              board_error.style.display = 'inline';
              log('failed to parse ' + control_string);
              console.error('failed to parse ' + control_string);
              control_string = '';
          }, 2000);
        }

        control_string += m;

        var result = true;
        var regexp = {
          init_message: /((OpenBCI [\w ]+) Board\nSetting ADS1299 Channel Values\n(ADS1299 Device ID: \w+\r\nLIS3DH Device ID: \w+))\r\n\$\$\$/,
          registers_message: /(ID,[^\$]+)\$\$\$/,
          registers_get_message: /(\d\d\d\d\d\d)\$\$\$/,
          is_num: /\d/,
          is_line: /([^\r]+)\r\n/
        };

        while (result) {

          // FIXME : send control_string on timeout if there is no pattern to find (ex : d ? D ? )

          // console.log('1 > ' + control_string.replace(/\r/gm,'\\r').replace(/\n/gm,'\\n').replace(/\t/gm,'\\t'));

          if (control_string[0] === 'O') {

            result = regexp.init_message.exec(control_string);
            if (result) {
              // set IDs
              log('obci > ' + result[1].replace(/\n/gm,' ').replace(/\r/gm,' '));
              document.getElementById('device_ID_' + identifier).textContent = ' - ' + result[2] + ' - ' + result[3];
            }
          }
          else if (control_string[0] === 'I') {
            result = regexp.registers_message.exec(control_string)
            if (result) {
              log('obci > ' + result[1]);
              // TODO (2) : set registers
            }
          }
          else if (regexp.is_num.exec(control_string[0])) {
            console.log('ISNUM');
            result = regexp.registers_get_message.exec(control_string);
            if (result) {
              // TODO (1) : set channels state
              log('obci > ' + result[1]);
            }
          }
          else {
            result = regexp.is_line.exec(control_string);
            if (result) {
              log('obci > ' + result[1]); // TODO (5) : decode and check settings change ack ?
            }
          }

          if (result) { // cut the section
            control_string = control_string.slice(result[0].length);
            // console.log('CUT > ' + control_string.length  + ' - ' + result[0].length );
            if (control_string.length === 0) {
              clearTimeout(control_timeout_ID);
              control_timeout_ID = undefined;
            }
          }

         // console.log('2 > ' + control_string);
        }

      }
      else {
        log('obci > ' + JSON.stringify(m)); // TODO (1) : request decoder
        console.log('serial unknown oncontrol ' + m + ' m:' + JSON.stringify(m));
      }
    },
    onstate: function(m) {
      console.log(identifier + ' onstate ' + m.old_state + ' >> ' + m.state); // TODO (1) : request decoder

      if (m.state === m.old_state) {
        return;
      }

      board_state.textContent = i18n.board_state[m.state];
      board_state.className = m.state;

      if (m.state !== 'STATE_IDLE') {
        bsb_get.disabled = true;
        bsb_reset.disabled = true;
        bsb_set.board_virtual_disabled = true; // regardless of current settings changes
        bsb_get_registers.disabled = true;
      }

      // TODO (5) : if (m.state === 'STATE_STREAMING')  set another handler to channels disable/enable ?

      switch (m.state) {
        case 'STATE_CLOSED':
          open_close_button.value = i18n.open;
          open_close_button.onclick = open_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.disabled = true;
          reset_board_button.disabled = true;
          break;
        case 'STATE_OPENING':
        case 'STATE_INIT':
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.disabled = true;
          reset_board_button.disabled = false;
          break;
        case 'STATE_IDLE':
          console.log('idle (onready) '  + m.control);
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = false;
          start_stop_button.value = i18n.start;
          start_stop_button.onclick = start_handler;
          start_stop_button.disabled = false;
          reset_board_button.disabled = false;

          bsb_get.disabled = false;
          bsb_set.board_virtual_disabled = false; // regardless of current settings changes
          bsb_reset.disabled = false;
          bsb_get_registers.disabled = false;
          break;
        case 'STATE_STREAMING':
          open_close_button.value = i18n.close;
          open_close_button.disabled = true;
          start_stop_button.value = i18n.stop;
          start_stop_button.onclick = stop_handler;
          start_stop_button.disabled = false;
          reset_board_button.disabled = false; // allow for reseting board while streaming ?
          break;
        case 'STATE_WAIT_ENDING':
        case 'STATE_WRITING':
          open_close_button.value = i18n.close;
          open_close_button.onclick = close_handler;
          open_close_button.disabled = true;
          start_stop_button.value = i18n.stop;
          start_stop_button.disabled = true;
          reset_board_button.disabled = false;
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
