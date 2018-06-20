var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createPoints = require('gl-scatter3d')
var createMesh = require('gl-mesh3d')
var createIsosurface = require('../isosurface')

var mat4 = require('gl-mat4');

var MniObjReader = require('./lib/MniObjReader');

var getData = function(fn, callback) {
  var xhr = new XMLHttpRequest;
  xhr.onload = function() {
    callback(xhr.responseText);
  };
  xhr.open('GET', fn, true);
  xhr.send();
};

 
getData('example/data/realct.obj', function(mniObjString) {
getData('example/data/realct.txt', function(vertexIntensities) {
  vertexIntensities = vertexIntensities.split('\n');
  vertexIntensities.pop();
  vertexIntensities = vertexIntensities.map(parseFloat);

  var bounds = [[-100,-150,-100], [100, 100, 100]]

  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  window.addEventListener('resize', require('canvas-fit')(canvas))
  var gl = canvas.getContext('webgl')

  var camera = createCamera(canvas, {
    eye: [-250, 250, 250],
    up: [0, 0, 1],
    center: [0.5*(bounds[0][0]+bounds[1][0]),
             0.5*(bounds[0][1]+bounds[1][1]),
             0.5*(bounds[0][2]+bounds[1][2])],
    zoomMax: 500,
    mode: 'turntable'
  })

  // build a parser
  var mniObjReader = new MniObjReader();

  // feed the parser with some string content of a mniobj file
  mniObjReader.parse( mniObjString );

  // a whole lot of data, you may not use all of them
  var shapeData = mniObjReader.getShapeData();

  // these are the very interesting data you want to use:
  var indices = mniObjReader.getShapeRawIndices(0); // Uint32Array
  var positions = mniObjReader.getRawVertices();  // Float32Array
  var normals = mniObjReader.getRawNormals(); // Float32Array
  var colors = mniObjReader.getRawColors(); // Uint8Array
  var surfaceProperties = mniObjReader.getSurfaceProperties(); // object

  var threeify = function(arr, scaleFactor) {
    var res = [];
    for (var i=0; i<arr.length; i+=3) {
      res.push([arr[i]*scaleFactor, arr[i+1]*scaleFactor, arr[i+2]*scaleFactor]);
    }
    return res;
  };

  var mesh = createMesh(gl, {
    positions: threeify(positions, 1),
    cells: threeify(indices, 1),
    vertexNormals: threeify(normals, 1),
    vertexIntensity: vertexIntensities,
    colormap: "portland"
  });

  var initialData = {
    gl: gl,
    position: [],
    color: [],
    size: 30,
    orthographic: true,
    lineColor: [0,0,0],
    lineWidth: 1,
    project: [true, true, true]
  }

  var points = createPoints(initialData);

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

  canvas.ondblclick = function(ev) {
    ev.preventDefault();
    var x = ev.clientX;
    var y = ev.clientY;
    var pickData = select.query(x, canvas.height - y, 10)
    var pickResult = mesh.pick(pickData);
    if(pickResult) {
      var pos = pickResult.position;
      var color = [255, 0, 0];
      initialData.position.push(pos);
      initialData.color.push(color);
      points.update(initialData);
    }
  };

  mouseChange(canvas, function(buttons, x, y) {
    var pickData = select.query(x, canvas.height - y, 10)
    var pickResult = mesh.pick(pickData);
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
  mat4.scale(doubleY, doubleY, [1,1,1]);

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
      if (initialData.position.length > 0) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, -20);
        points.axes = axes;
        points.draw(cameraParams)
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
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
})
})