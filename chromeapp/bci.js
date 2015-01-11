'use strict'

var bci_plot;
var bci_data;
var buffer_size = 1024;

window.addEventListener('load', function() {

  var canvas_container = document.getElementById('canvas_container');

  bci_data = DataCollector(8, buffer_size, true);
  bci_plot = CanvasPlotter(canvas_container, bci_data);

} );


var CanvasPlotter = function(container, dataset) {

  if (dataset.length > 8) {
    throw "CanvasPlotter can only manage 8 channels";
  }

  var canvas = document.createElement('canvas');
  canvas.GRAPH_HEIGHT = 50; // half of excursion
  var ctx = canvas.getContext("2d");
  var transform = [
    {scaleX: 1, scaleY: 1, dx: 0, dy: 50},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 150},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 250},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 350},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 450},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 550},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 650},
    {scaleX: 1, scaleY: 1, dx: 0, dy: 750}
  ];
  var signal_color = [
    '#FF4444',
    '#44FF44',
    '#4444FF',
    "#FF44FF",
    '#44FFFF',
    '#FFFF44',
    '#4444FF',
    "#FF44FF"
  ];
  var axis_color = [
    '#FFAAAA',
    '#AAFFAA',
    '#AAAAFF',
    "#FFAAFF",
    '#AAFFFF',
    '#FFFFAA',
    '#AAAAFF',
    "#FFAAFF"
  ];

  var _drawGrid = function() {

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#C0C0C0';

    for (var x = 0 ; x < canvas.width ; x += 50) {
      ctx.beginPath(), ctx.moveTo(x, 0), ctx.lineTo(x, canvas.height), ctx.stroke()
    }
    for (var y = 0 ; y < canvas.height ; y += 50) {
      ctx.beginPath(), ctx.moveTo(0, y), ctx.lineTo(canvas.width, y), ctx.stroke()
    }
  }

  var _drawData = function () {

    var t;

    ctx.lineWidth = 1;

    for (var c = 0 ; c < dataset.length ; c++) {

      // var data = datasets[channel];
      ctx.save();

      t = transform[c];

      // ctx.setTransform(scaleX, skewX, skewY, scaleY, translateX, translateY);
      ctx.setTransform(t.scaleX, 0, 0, t.scaleY, t.dx, t.dy);

      ctx.strokeStyle = axis_color[c];
      ctx.beginPath(), ctx.moveTo(0, 0), ctx.lineTo(dataset[c].length, 0), ctx.stroke()

      ctx.save();
      ctx.setTransform(t.scaleX, 0, 0, -t.scaleY / dataset[c].max_value * canvas.GRAPH_HEIGHT, t.dx, t.dy);
      ctx.strokeStyle = signal_color[c];
      ctx.beginPath();
      ctx.moveTo(0, dataset[c][0]);

      for (var x = 1 ; x < dataset[c].length ; x++) {
        ctx.lineTo(x, dataset[c][x]);
      }

      ctx.stroke();

      ctx.strokeStyle = axis_color[c];
      ctx.beginPath(), ctx.moveTo(dataset.write_position, -dataset[c].max_value), ctx.lineTo(dataset.write_position, dataset[c].max_value), ctx.stroke();

      ctx.restore();

      ctx.fillStyle = signal_color[c];
      ctx.fillText(dataset[c].max_value, 0, canvas.GRAPH_HEIGHT - 2);
      // if (dataset.write_position > 0) // test does not matter for one single step, data[-1] returns undefined and does not throw error
      ctx.fillText(dataset[c][dataset.write_position - 1], dataset.write_position, 10-canvas.GRAPH_HEIGHT); // TODO : (ctx.measureText() * wh_ratio)

      ctx.restore();
    }
  }

  var _drawFFT = function(fftset) {

      var t;

     for (var c = 0 ; c < fftset.length ; c++) {

      // var data = datasets[channel];
      ctx.save();

      t = transform[c];

      // ctx.setTransform(scaleX, skewX, skewY, scaleY, translateX, translateY);
      ctx.setTransform(t.scaleX, 0, 0, -t.scaleY / fftset[c].maxre * canvas.GRAPH_HEIGHT * 2, t.dx + buffer_size + 20, t.dy + canvas.GRAPH_HEIGHT);

      ctx.strokeStyle = axis_color[c];
      ctx.beginPath(), ctx.moveTo(0, 0), ctx.lineTo(fftset[c].length, 0), ctx.stroke()

      ctx.save();
    //  ctx.setTransform(t.scaleX, 0, 0, -t.scaleY / fftset[c].re.max_value * (canvas.GRAPH_HEIGHT), t.dx, t.dy);
      ctx.strokeStyle = signal_color[c];
      ctx.beginPath();
      ctx.moveTo(0, fftset[c].re[0]);

      for (var x = 1 ; x < fftset[c].re.length / 2 ; x++) {
        ctx.lineTo(x, fftset[c].re[x]);
      }

      ctx.stroke();

      ctx.restore();

      ctx.restore();
    }

  }

  if (ctx.redraw) {throw "canvas.context.redraw is already defined"};
  ctx.redraw = function() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _drawGrid();
    _drawData();
    _drawFFT(dataset.fftset);
  }

  canvas.width = 1800;
  canvas.height = canvas.GRAPH_HEIGHT * 2 * dataset.length;

  container.appendChild(ctx.canvas);

  return ctx;
}


var DataCollector = function(channel_count, buf_len, calc_fft) {


  var dataset = [];
  dataset.max_value = [];
  dataset.buffer_length = buf_len;

  var fftset = [];

  for (var c = 0 ; c < channel_count ; c++ ) {
    dataset[c] = new Int32Array(buf_len);
    dataset[c].max_value = 0;

      if (calc_fft) {
        fftset[c] = {re: new Int32Array(buf_len), im: new Int32Array(buf_len)};
      }
  }

  var write_marker = 0;

  dataset.feed = function(frame) {

    for (var c = 0 ; c < dataset.length ; c++ ) {
      dataset[c][write_marker] = frame[c];
      dataset[c].max_value = Math.max(Math.abs(frame[c]), dataset[c].max_value);
    }

    write_marker++;

    if (write_marker === dataset.buffer_length) {

      write_marker = 0;
      for (var c = 0 ; c < dataset.length ; c++ ) {
        dataset[c].max_value = 0;
      }

      if (calc_fft) {
        for (var c = 0 ; c < fftset.length ; c++ ) {
          fftset[c].re.set(dataset[c]);
          fft(1, fftset[c].re.length, fftset[c].re, fftset[c].im);

          var max = 0;
          for (var i = 0 ; i < fftset[c].re.length / 2 ; i++) {
            fftset[c].re[i] = Math.abs(fftset[c].re[i]);
            max = Math.max(max, fftset[c].re[i]);
          }
          fftset[c].maxre = max;
        }
      }
    }

    dataset.write_position = write_marker;
  }

  dataset.fftset = fftset; // TODO : separate signal and fft buffers

  return dataset;
}


var onBciProcess = function (samples) {

     // console.log('onBciProcess > samples:' + samples.length);

      bci_data.feed(samples);
}

// FFT

/*
// TODO : use audio API for FFT ?

// @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
// @see https://developer.mozilla.org/fr/docs/Web/API/AudioBufferSourceNode

var frame_count = 1024 * 8;
var sample_rate = frame_count;

var audioContext = new window.AudioContext();
var analyserNode = audioContext.createAnalyser();
analyserNode.fftSize = buffer_size;
var signalArrayBuffer = audioContext.createBuffer(8, frame_count, sample_rate);
var source = audioContext.createBufferSource();
source.buffer = signalArrayBuffer;
source.connect( analyserNode );
  // source.start();

var _drawFFT = function() {

  var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(freqByteData);
}
*/



var fft = function(Ind, Npair, Ar, Ai) {
    /*=========================================
     * Calculate the floating point complex FFT
     * Ind = +1 => FORWARD FFT
     * Ind = -l => INVERSE FFT
     * Data is passed in Npair Complex pairs
     * where Npair is power of 2 (2^N)
     * data is indexed from 0 to Npair-1
     * Real data in Ar
     * Imag data in Ai.
     *
     * Output data is returned in the same arrays,
     * DC in bin 0, +ve freqs in bins 1..Npair/2
     * -ve freqs in Npair/2+1 .. Npair-1.
     *
     * ref: Rabiner & Gold
     * "THEORY AND APPLICATION OF DIGITAL
     *  SIGNAL PROCESSING" p367
     *
     * Translated to JavaScript by A.R.Collins
     * <http://www.arc.id.au>
     *========================================*/

    var Pi = Math.PI,
        Num1, Num2, i, j, k, L, m, Le, Le1,
        Tr, Ti, Ur, Ui, Xr, Xi, Wr, Wi, Ip;

    function isPwrOf2(n)
    {
      var p = -1;
      for (p=2; p<13; p++)
      {
        if (Math.pow(2,p) === n)
        {
          return p;
        }
      }
      return -1;
    }

    m = isPwrOf2(Npair);
    if (m<0)
    {
      alert("Npair must be power of 2 from 4 to 4096");
      return;
    }

    Num1 = Npair-1;
    Num2 = Npair/2;
    // if IFT conjugate prior to transforming:
    if (Ind < 0)
    {
      for(i = 0; i < Npair; i++)
      {
        Ai[i] *= -1;
      }
    }

    j = 0;    // In place bit reversal of input data
    for(i = 0; i < Num1; i++)
    {
      if (i < j)
      {
        Tr = Ar[j];
        Ti = Ai[j];
        Ar[j] = Ar[i];
        Ai[j] = Ai[i];
        Ar[i] = Tr;
        Ai[i] = Ti;
      }
      k = Num2;
      while (k < j+1)
      {
        j = j-k;
        k = k/2;
      }
      j = j+k;
    }

    Le = 1;
    for(L = 1; L <= m; L++)
    {
      Le1 = Le;
      Le += Le;
      Ur = 1;
      Ui = 0;
      Wr = Math.cos(Pi/Le1);
      Wi = -Math.sin(Pi/Le1);
      for(j = 1; j <= Le1; j++)
      {
        for(i = j-1; i <= Num1; i += Le)
        {
          Ip = i+Le1;
          Tr = Ar[Ip]*Ur-Ai[Ip]*Ui;
          Ti = Ar[Ip]*Ui+Ai[Ip]*Ur;
          Ar[Ip] = Ar[i]-Tr;
          Ai[Ip] = Ai[i]-Ti;
          Ar[i] = Ar[i]+Tr;
          Ai[i] = Ai[i]+Ti;
        }
        Xr = Ur*Wr-Ui*Wi;
        Xi = Ur*Wi+Ui*Wr;
        Ur = Xr;
        Ui = Xi;
      }
    }
    // conjugate and normalise
    if(Ind<0)
    {
      for(i=0; i<Npair; i++)
      {
        Ai[i] *= -1;
      }
    }
    else
    {
      for(i=0; i<Npair; i++)
      {
        Ar[i] /= Npair;
        Ai[i] /= Npair;
      }
    }
};
