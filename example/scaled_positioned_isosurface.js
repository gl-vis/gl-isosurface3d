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

var data = new Uint16Array(width*height*depth)
var meshgrid = [[], [], []];
for (var z=0; z<depth; z++) {
  meshgrid[2].push(z);
  for (var y=0; y<height; y++) {
    if (z === 0) {
      meshgrid[1].push(y);
    }
    for (var x=0; x<width; x++) {
      if (z === 0 && y === 0) {
        meshgrid[0].push(x);
      }
    	var value = 1500 + 500 * (
    		Math.sin(2 * 2*Math.PI*(z/depth-0.5)) +
    		Math.cos(3 * 2*Math.PI*(x/width-0.5)) +
    		Math.sin(4 * 2*Math.PI*(y/height-0.5))
    	);
    	data[z*height*width + y*width + x] = value
    }
  }
}

var dims = [width, height, depth]
var bounds = [[0,0,0], [width, height, depth]]

var isoPlot = createIsosurface({
	values: data,
	dimensions: dims,
  meshgrid: meshgrid,
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
