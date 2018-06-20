var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createIsosurface = require('../isosurface')

var vec3 = require('gl-vec3')
var mat4 = require('gl-mat4')

var createMesh = require('gl-mesh3d')
var createConePlot = require('gl-cone3d')

var wind = require('./dataset-wind')

var idxs = wind.positions.map(function(p, idx) { return {p: p, idx: idx} });
idxs.sort(function(a,b) {
  var zd = a.p[2] - b.p[2];
  var yd = a.p[1] - b.p[1];
  var xd = a.p[0] - b.p[0];
  return zd || yd || xd;
});

var nw = {
  positions: [],
  vectors: [],
};

idxs.forEach(function(pidx, i) {
  nw.positions[i] = wind.positions[pidx.idx];
  nw.vectors[i] = wind.vectors[pidx.idx];
})

console.time("Total mesh creation time")
console.log("Isosurface demo");

var width = 41
var height = 35
var depth = 15

var data = new Float32Array(width*height*depth)
for (var z=0; z<depth; z++)
for (var y=0; y<height; y++)
for (var x=0; x<width; x++) {
  var idx = z*width*height + y*width + x;
	data[idx] = vec3.length(nw.vectors[idx]);
}

var dims = [width, height, depth]
var bounds = [[0,0,0], [width, height, depth]]

var isoPlot = createIsosurface({
	values: data,
	dimensions: dims,
	isoBounds: [40, Infinity],
  vertexIntensityBounds: [42, 60],
	smoothNormals:  true,
	isoCaps: true,
	singleMesh: false,
  colormap: 'portland',
  capsColormap: 'jet'
}, bounds)

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', require('canvas-fit')(canvas))
var gl = canvas.getContext('webgl')


var mesh = createIsosurface.createTriMesh(gl, isoPlot)
console.log(mesh);

var capMesh = createIsosurface.createTriMesh(gl, isoPlot.caps)

console.timeEnd("Total mesh creation time")


console.time("Cone plot creation");

var conePlot = createConePlot({
  positions: nw.positions,
  vectors: nw.vectors,
  colormap: 'portland'
}, bounds)

var coneMesh = createMesh(gl, conePlot)

console.timeEnd("Cone plot creation");

var camera = createCamera(canvas, {
  eye:    bounds[1].map(function(x) { return x*2 }),
  center: [0.5*(bounds[0][0]+bounds[1][0]),
           0.5*(bounds[0][1]+bounds[1][1]),
           0.5*(bounds[0][2]+bounds[1][2])],
  zoomMax: 500,
  mode: 'turntable'
})


var meshMatrix = mat4.create();
mat4.identity(meshMatrix);
mat4.translate(meshMatrix, meshMatrix, bounds[0]);
var diff = vec3.create();
vec3.divide(diff, vec3.subtract(diff, bounds[1], bounds[0]), dims);
mat4.scale(meshMatrix, meshMatrix, diff);




var select = createSelect(gl, [canvas.width, canvas.height])
var tickSpacing = 5;
var ticks = bounds[0].map(function(v,i) {
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
  var pickResult = mesh.pick(pickData)
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

function render() {
  requestAnimationFrame(render)

  gl.enable(gl.DEPTH_TEST)

  var needsUpdate = camera.tick()
  var cameraParams = {
    projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
    view: camera.matrix
  }
  var meshCameraParams = {
    projection: cameraParams.projection,
    view: cameraParams.view,
    model: meshMatrix
  }

  if(needsUpdate || spikeChanged) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    axes.draw(cameraParams)
    spikes.draw(cameraParams)
    mesh.draw(meshCameraParams)
    capMesh.draw(meshCameraParams)
    coneMesh.draw(cameraParams)
    spikeChanged = false
  }

  if(needsUpdate) {
    select.shape = [canvas.width, canvas.height]
    select.begin()
    mesh.drawPick(cameraParams)
    select.end()
  }
}
render()
