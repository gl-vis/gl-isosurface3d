var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createIsosurface = require('../isosurface')

var mat4 = require('gl-mat4');

var getData = function(fn, callback) {
  var xhr = new XMLHttpRequest;
  xhr.onload = function() {
    callback(xhr.responseText);
  };
  xhr.open('GET', fn, true);
  xhr.send();
};

var parseCSV = function(str) {
  return str.replace(/^\s+|\s+$/g, '').split(/\r?\n/g).map(x => x.split(',').map(parseFloat));
};


getData('example/data/mri.csv', function(mricsv) {
  console.log("Volume demo");
  console.time("Total mesh creation time")

  var mri = parseCSV(mricsv.replace(/\r?\n/g, ','))[0];
  mri.pop();

  var dims = [128, 27, 128]
  var [width, height, depth] = dims;
  var bounds = [[0,0,0], [width, height, depth]]

  console.time("Total mesh creation time")

  var isoPlot = createIsosurface({
    values: mri,
    dimensions: dims,
    isoBounds: [20, 255],
    vertexIntensityBounds: [-500,-400],
    smoothNormals: true,
    isoCaps: true,
    singleMesh: false,
    colormap: 'copper',
    capsColormap: 'greys',
    capsVertexIntensityBounds: [0, 100]
  }, bounds)

  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  window.addEventListener('resize', require('canvas-fit')(canvas))
  var gl = canvas.getContext('webgl')

  var camera = createCamera(canvas, {
    eye: [-100, 0, 250],
    up: [0, 1, 0],
    center: [0.5*(bounds[0][0]+bounds[1][0]),
             0.5*(bounds[0][1]+bounds[1][1]),
             0.5*(bounds[0][2]+bounds[1][2])],
    zoomMax: 500,
    mode: 'turntable'
  })

  var mesh = createIsosurface.createTriMesh(gl, isoPlot)
  var capMesh = createIsosurface.createTriMesh(gl, isoPlot.caps)

  console.timeEnd("Total mesh creation time")

  var select = createSelect(gl, [canvas.width, canvas.height])
  var tickSpacing = 5;
  var ticks = bounds[0].map((v,i) => {
    var arr = [];
    var firstTick = Math.ceil(bounds[0][i] / tickSpacing) * tickSpacing;
    var lastTick = Math.floor(bounds[1][i] / tickSpacing) * tickSpacing;
    for (var tick = firstTick; tick <= lastTick; tick += tickSpacing) {
      if (tick === -0) tick = 0;
      arr.push({x: tick, text: tick.toString()});
    }
    return arr;
  });
  var axes = createAxes(gl, { bounds: bounds, ticks: ticks })
  var spikes = createSpikes(gl, {
    bounds: bounds
  })
  var spikeChanged = false

  mouseChange(canvas, function(buttons, x, y) {
    var pickData = select.query(x, canvas.height - y, 10)
    var pickResult = mesh.pick(pickData) || capMesh.pick(pickData);
    if(pickResult) {
      spikes.update({
        position: pickResult.position,
        enabled: [true, true, true]
      })
      spikeChanged = true
    } else {
      spikeChanged = spikes.enabled[0]
      spikes.update({
        enabled: [false, false, false]
      })
    }
  })

  var doubleY = mat4.create();
  mat4.scale(doubleY, doubleY, [1,2,1]);

  function render() {
    requestAnimationFrame(render)

    gl.enable(gl.DEPTH_TEST)

    var needsUpdate = camera.tick()
    var cameraParams = {
      projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
      view: camera.matrix,
      model: doubleY
    }

    if(needsUpdate || spikeChanged) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      axes.draw(cameraParams)
      spikes.draw(cameraParams)
      mesh.draw(cameraParams)
      capMesh.draw(cameraParams)
      spikeChanged = false
    }

    if(needsUpdate) {
      select.shape = [canvas.width, canvas.height]
      select.begin()
      mesh.drawPick(cameraParams)
      capMesh.drawPick(cameraParams)
      select.end()
    }
  }
  render()
})