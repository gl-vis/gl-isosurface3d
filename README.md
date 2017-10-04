gl-isosurface3d
=====================
Visualization module for isosurfaces.

# Example

```javascript
var createScene      = require('gl-plot3d')
var createMesh       = require('gl-mesh3d')
var createIsosurface = require('gl-isosurface3d')

var scene = createScene()

var width = 64
var height = 64
var depth = 64

var data = new Uint16Array(width*height*depth)
for (var z=0; z<depth; z++)
for (var y=0; y<height; y++)
for (var x=0; x<width; x++) {
	var value = 1500 + 500 * (
		Math.sin(3 * 2*Math.PI*(z/depth-0.5)) +
		Math.cos(4 * 2*Math.PI*(x/width-0.5)) +
		Math.sin(5 * 2*Math.PI*(h/height-0.5))
	);
	data[z*height*width + y*width + x] = value
}

var dims = [width, height, depth]
var bounds = [[0,0,0], [width, height, depth]]

var isoPlot = createIsosurface({
	values: data,
	dimensions: dims,
	isoRange: [1600, 2000],
	intensityRange: [1000, 2000],
	smoothNormals:  true,
	isoCaps: true
}, bounds)

isoPlot.colormap = 'portland'

var mesh = createMesh(gl, isoPlot)

scene.add(mesh)
```

# Install

```
npm i gl-isosurface3d
```
    
# Basic interface

## Constructor

#### `var isosurface = require('gl-isosurface3d')(params, bounds)`
Creates an isosurface out of a 3D array.

* `params` is an object that has the following properties:

    + `values` *(Required)* An flattened 3D array of values
    + `dimensions` *(Required)* The dimensions of the array
    + `isoRange` *(Recommended)* The range of values to envelop with the isosurface. Defaults to [1, Infinity], which creates an isosurface that has all values 1 and larger inside it.
    + `intensityRange` *(Optional)* The range of values to map to [0..1] intensities. Defaults to the minimum and maximum values of the values array.
    + `smoothNormals` *(Optional)* Generate vertex normals for the isosurface. Defaults to false.
    + `isoCaps` *(Optional)* Generate caps for the isosurface. Defaults to false.

* `bounds` is a bounds object that tells what part of the 3D array to display. It defaults to [[0, 0, 0], [width, height, depth]].

**Returns** A isosurface object that can be passed to gl-mesh3d.

# Credits
(c) 2013-2017 Mikola Lysenko, Ilmari Heikkinen. MIT License
