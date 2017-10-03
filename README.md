gl-isosurface3d
=====================
Visualization module for isosurfaces.

# Example

```javascript
var createScene      = require('gl-plot3d')
var createMesh       = require('gl-mesh3d')
var createIsosurface = require('gl-isosurface3d')

var scene = createScene()

var data = new Uint16Array(width*height*depth)
var dims = [width, height, depth]
var bounds = [[0,0,0], [width, height, depth]];

var isoPlot = createIsosurface({
	values: data,
	dimensions: dims,
	isoRange: [1500, 1700],
	intensityRange: [1300, 2200],
	smoothNormals:  true
}, bounds);

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

    + `positions` *(Required)* An array of positions for the vector field, encoded as arrays
    + `vectors` *(Required)* An array of vectors for the vector field, encoded as arrays

**Returns** A cone plot object that can be passed to gl-mesh3d.

# Credits
(c) 2013-2017 Mikola Lysenko, Ilmari Heikkinen. MIT License
