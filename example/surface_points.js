var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createPoints = require('gl-scatter3d')
var createIsosurface = require('../isosurface')

var mat4 = require('gl-mat4');

var getData = function(fn, responseType, callback) {
  if (!callback) {
    callback = responseType;
    responseType = 'text';
  }
  var xhr = new XMLHttpRequest;
  xhr.responseType = responseType;
  xhr.onload = function() {
    callback(xhr.response);
  };
  xhr.open('GET', fn, true);
  xhr.send();
};

getData('example/data/MRbrain.txt', 'arraybuffer', function(mriBuffer) {

  const dims = [256, 256, 109];
  const bounds = [[30, 30, 30], [256-30, 256-30, 109-30]];
  const [dataWidth, dataHeight, dataDepth] = dims;

  const mri = new Uint16Array(mriBuffer);
  for (var i=0; i<mri.length; i++) {
    mri[i] = ((mri[i] << 8) & 0xff00) | (mri[i] >> 8);
  }

  console.time("Total mesh creation time")

  var isoPlot = createIsosurface({
    values: mri,
    dimensions: dims,
    vertexIntensityBounds: [1300, 3000],
    isoBounds: [1300, 25000],
    smoothNormals: true,
    isoCaps: true
  }, bounds)

  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  window.addEventListener('resize', require('canvas-fit')(canvas))
  var gl = canvas.getContext('webgl')

  var camera = createCamera(canvas, {
    eye: [-100, 0, 250],
    up: [0, -1, 0],
    center: [0.5*(bounds[0][0]+bounds[1][0]),
             0.5*(bounds[0][1]+bounds[1][1]),
             0.5*(bounds[0][2]+bounds[1][2])],
    zoomMax: 500,
    mode: 'turntable'
  })

  isoPlot.colormap = 'portland'
  isoPlot.caps.colormap = 'portland'
  var mesh = createIsosurface.createTriMesh(gl, isoPlot)
  var capMesh = createIsosurface.createTriMesh(gl, isoPlot.caps)

  var points = [], glyphs = [], colors = [];
  var pos = isoPlot.positions;
  for (var i=0; i<100; i++) {
    var off = Math.floor(Math.random()*pos.length/3)*3;
    points.push([
      pos[off],
      pos[off+1],
      pos[off+2]
    ]);
    glyphs.push("✖");
    colors.push([1,0,0]);
  }

  var initialData = {
    gl: gl,
    position: points,
    glyph: glyphs,
    color: colors,
    size: 30,
    orthographic: true,
    lineColor: [0,0,0],
    lineWidth: 1,
    project: [true, true, true]
  }

  var points = createPoints(initialData);

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

  var stretchZ = mat4.create();
  mat4.scale(stretchZ, stretchZ, [1,1,1.2]);

  function render() {
    requestAnimationFrame(render)

    gl.enable(gl.DEPTH_TEST)
    gl.polygonOffset(1, -20);

    var needsUpdate = camera.tick()
    var cameraParams = {
      projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
      view: camera.matrix,
      model: stretchZ
    }

    if(needsUpdate || spikeChanged) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      axes.draw(cameraParams)
      spikes.draw(cameraParams)
      mesh.draw(cameraParams)
      capMesh.draw(cameraParams)
      gl.enable(gl.POLYGON_OFFSET_FILL);
      points.axes = axes;
      points.draw(cameraParams)
      gl.disable(gl.POLYGON_OFFSET_FILL);
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