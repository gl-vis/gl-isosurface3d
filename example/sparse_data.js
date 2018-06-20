var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createIsosurface = require('../isosurface')

console.time("Total mesh creation time")
console.log("Isosurface demo");

var width = 64
var height = 64
var depth = 64

var sparseData = { positions: [], intensities: [] };
for (var i=0; i<100000; i++) {
  var x = 3*(Math.random()-0.5);
  var y = 3*(Math.random()-0.5);
  var z = 3*(Math.random()-0.5);
  sparseData.positions.push([x, y, z]);
  sparseData.intensities.push(1500 + 500 * (Math.sin(2*x) + Math.cos(3*y) + Math.sin(4*z)));
}

var splatToData = function(position, value, bounds, data, width, height, depth) {
  // Map position values to 0..1 range
  var rx = (position[0] - bounds[0][0]) / (bounds[1][0] - bounds[0][0]);
  var ry = (position[1] - bounds[0][1]) / (bounds[1][1] - bounds[0][1]);
  var rz = (position[2] - bounds[0][2]) / (bounds[1][2] - bounds[0][2]);
  // Convert relative coordinates to data box indices.
  var x = Math.round(rx * width);
  var y = Math.round(ry * height);
  var z = Math.round(rz * depth);
  // Reject data that's outside the bounds.
  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
    return;
  }
  // Splat the intensity to the data box.
  // TODO Trilinear sampling.
  data[z*height*width + y*width + x] = value;
}

var boxBlur = function(newData, data, width, height, depth) {
  for (var z=1; z<depth-1; z++)
  for (var y=1; y<height-1; y++)
  for (var x=1; x<width-1; x++) {
    var v = 0;
    var c = 0;
    for (var dz=-1; dz<2; dz++)
    for (var dy=-1; dy<2; dy++)
    for (var dx=-1; dx<2; dx++) {
      v = Math.max(v, data[(z+dz)*height*width + (y+dy)*width + (x+dx)]);
      c++;
    }
    //if (z === 30 && y === 30)
    //  console.log(v, c, v/c, data[z*height*width + y*width + x]);
    newData[z*height*width + y*width + x] = v ; //(v / c);
  }
  for (var z=0; z<depth; z++)
  for (var y=0; y<height; y++)
  for (var x=0; x<width; x++) {
    if (x === 0 || y === 0 || z === 0 || x === width-1 || y === height-1 || z === depth-1) {
      newData[z*height*width + y*width + x] = data[z*height*width + y*width + x];
    }
  }
}

var data = new Uint16Array(width*height*depth);
var blurredData = new Uint16Array(width*height*depth);
var bounds = [[-1,-1,-1], [1,1,1]];
for (var i=0; i<sparseData.positions.length; i++) {
  splatToData(sparseData.positions[i], sparseData.intensities[i], bounds, data, width, height, depth);
}
boxBlur(blurredData, data, width, height, depth);

var dims = [width, height, depth]
var bounds = [[0,0,0], [width, height, depth]]

var isoPlot = createIsosurface({
	values: blurredData,
	dimensions: dims,
	isoBounds: [1600, 2000],
	vertexIntensityBounds: [1500, 2000],
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

var camera = createCamera(canvas, {
  eye:    [90, 90, 90],
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
var ticks = bounds[0].map(function(v,i) {
  var arr = [];
  var firstTick = Math.ceil(bounds[0][i] / tickSpacing) * tickSpacing;
  var lastTick = Math.floor(bounds[1][i] / tickSpacing) * tickSpacing;
  for (var tick = firstTick; tick <= lastTick; tick += tickSpacing) {
    if (tick === -0) tick = 0;
    arr.push({x: tick, text: tick.toString()});
  }
  return arr;
})
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
    select.end()
  }
}
render()
