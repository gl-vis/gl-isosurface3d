/**
* MniObjReader is a parser of mniobj surface files. This version is an atempt of
* making a free from dependency independant module. It is based on the code witten
* by Nicolas Kassis and Tarek Sherif for BrainBrowser
* (https://brainbrowser.cbrain.mcgill.ca).
*
* Since mniobj file can be huge, it may be a good idea to call that froma worker.
*
* @author: Jonathan Lurie (github.com/jonathanlurie)
* @author: Nicolas Kassis
* @author: Tarek Sherif
*/


/**
* Constructor of the MniObjReader.
*/
var MniObjReader = function(){
  this._stack = null;
  this._stackIndex = null;
  this._tempResult = null;
  this._shapeData = null;
}

if (typeof module !== 'undefined') {
  module.exports = MniObjReader;
}

/**
* Copy an existing MniObjReader instance.
* This is particularly usefull in the context of a worker, if an MniObjReader
* is returned, it is using a JSON format to transfer, meaning all the methods
* are lost and only remains the data. This is to rebuild a proper MniObjReader.
* @param {MniObjReader} MniObjReaderInstance - the instance to copy the data from.
*/
MniObjReader.prototype.copy = function( MniObjReaderInstance ) {
  this._stack = MniObjReaderInstance._stack;
  this._stackIndex = MniObjReaderInstance._stackIndex
  this._tempResult = MniObjReaderInstance._tempResult
  this._shapeData = MniObjReaderInstance._shapeData;
}


/**
* Parse the nmiobj string.
* @param {String} objString - This string is obviously taken out of a obj file
*/
MniObjReader.prototype.parse = function(objString) {
  this._parseRawData( objString );
  this._arrangeData();
}


/**
* Parse a obj string
* @param {String} objString - content of the obj file
*/
MniObjReader.prototype._parseRawData = function( objString ){
  this._stack = objString.trim().split(/\s+/).reverse();
  this._stackIndex = this._stack.length - 1;
  this._tempResult = {};

  var splitHemispheres = false;  //TODO remove that and the code that depends on that
  var objectClass = this._popStack();
  var start, end, nitems;
  var indices, endIndices;
  var lineIndices = null;
  var lineIndexSize, lineIndexCounter;

  // By default models are not split
  // (this option allows us to split hemispheres
  // into two separate models.)
  this._tempResult.split = false;

  this._tempResult.type = objectClass === "P" ? "polygon" :
                objectClass === "L" ? "line" :
                objectClass;

  if(this._tempResult.type === "polygon") {
    this._parseSurfProp();
    this._tempResult.numVertices = parseInt(this._popStack(), 10);
    this._parseVertices();
    this._parseNormals();
    this._tempResult.nitems = parseInt(this._popStack(), 10);
  } else if (this._tempResult.type === "line") {
    this._parseSurfProp();
    this._tempResult.numVertices = parseInt(this._popStack(), 10);
    this._parseVertices();
    this._tempResult.nitems = parseInt(this._popStack(), 10);
  } else {
    this._tempResult.error = true;
    this._tempResult.errorMessage = 'Invalid MNI Object class: must be "polygon" or "line"';
    return;
  }

  this._parseColors();
  this._parseEndIndices();
  this._parseIndices();

  if (this._tempResult.type === "polygon" ) {
    if (splitHemispheres){
      this._tempResult.split = true;
      this._splitHemispheres();
    }
  } else if (this._tempResult.type === "line") {
    indices = this._tempResult.indices;
    endIndices = this._tempResult.endIndices;
    nitems = this._tempResult.nitems;
    lineIndexSize = lineIndexCounter = 0;

    for (var i = 0; i < nitems; i++){
      if (i === 0){
        start = 0;
      } else {
        start = endIndices[i - 1];
      }

      end = endIndices[i];
      lineIndexSize += (end - start - 1) * 2;
    }

    lineIndices = new Uint32Array(lineIndexSize);

    for (var i = 0; i < nitems; i++){
      if (i === 0){
        start = 0;
      } else {
        start = endIndices[i - 1];
      }

      lineIndices[lineIndexCounter++] = indices[start];
      end = endIndices[i];

      for (var j = start + 1; j < end - 1; j++) {
        lineIndices[lineIndexCounter++] = indices[j];
        lineIndices[lineIndexCounter++] = indices[j];
      }

      lineIndices[lineIndexCounter++] = indices[end - 1];
    }

    this._tempResult.indices = lineIndices;
  }
}


/**
* [PRIVATE]
* Rearange the data from _tempResult to _shapeData
*/
MniObjReader.prototype._arrangeData = function() {

    this._shapeData = {
      type: this._tempResult.type,
      vertices: this._tempResult.vertices,
      normals: this._tempResult.normals,
      colors: this._tempResult.colors,
      surfaceProperties: this._tempResult.surfaceProperties,
      split: this._tempResult.split,
      error: this._tempResult.error,
      errorMessage: this._tempResult.errorMessage
    };

    var transfer = [
      this._shapeData.vertices.buffer,
      this._shapeData.colors.buffer
    ];

    if (this._shapeData.normals) {
      transfer.push(this._shapeData.normals.buffer);
    }

    if (this._shapeData.split) {
      this._shapeData.shapes = [
        { indices: this._tempResult.left.indices },
        { indices: this._tempResult.right.indices }
      ];

      transfer.push(
        this._tempResult.left.indices.buffer,
        this._tempResult.right.indices.buffer
      );
    } else {
      this._shapeData.shapes = [
        { indices: this._tempResult.indices }
      ];
      transfer.push(
        this._tempResult.indices.buffer
      );
    }

    // unroll colors if necessary
    if(this._shapeData.colors.length === 4) {
      this._unrollColors();
    }
}


/**
* [PRIVATE]
* From a single color, make a typed array (Uint8) of colors.
*/
MniObjReader.prototype._unrollColors = function() {
  var dataColor0, dataColor1, dataColor2, dataColor3;
  var count;
  var nbTriangles = this._shapeData.vertices.length / 3;
  var arraySize = nbTriangles * 4;
  var unrolledColors = new Uint8Array(arraySize);

  dataColor0 = this._shapeData.colors[0];
  dataColor1 = this._shapeData.colors[1];
  dataColor2 = this._shapeData.colors[2];
  dataColor3 = this._shapeData.colors[3];

  for(var i=0; i<arraySize; i+=4){
    unrolledColors[i]     = dataColor0 * 255;
    unrolledColors[i + 1] = dataColor1 * 255;
    unrolledColors[i + 2] = dataColor2 * 255;
    unrolledColors[i + 3] = dataColor3 * 255;
  }

  this._shapeData.colors = unrolledColors;
}


/**
* [PRIVATE]
* Parse surface properties from the raw data.
*/
MniObjReader.prototype._parseSurfProp = function() {
  if (this._tempResult.type === "polygon") {
    this._tempResult.surfaceProperties = {
      ambient: parseFloat(this._popStack()),
      diffuse: parseFloat(this._popStack()),
      specularReflectance: parseFloat(this._popStack()),
      specularScattering: parseFloat(this._popStack()),
      transparency: parseFloat(this._popStack())
    };

  }else if (this._tempResult.type === "line") {
    this._tempResult.surfaceProperties = {
      width: this._popStack()
    };
  }
}


/**
* [PRIVATE]
* Parse the vertices from the raw data.
*/
MniObjReader.prototype._parseVertices = function() {
  var count = this._tempResult.numVertices * 3;
  var vertices = new Float32Array(count);
  var that = this;

  for (var i = 0; i < count; i++) {
    vertices[i] = parseFloat(this._popStack());
  }

  this._tempResult.vertices = vertices;
}


/**
* [PRIVATE]
* Parse the normal vector from the raw data.
*/
MniObjReader.prototype._parseNormals = function() {
  var count = this._tempResult.numVertices * 3;
  var normals = new Float32Array(count);

  for (var i = 0; i < count; i++) {
    normals[i] = parseFloat(this._popStack());
  }

  this._tempResult.normals = normals;
}


/**
* [PRIVATE]
* Parse the color from the raw data.
*/
MniObjReader.prototype._parseColors = function() {
  var colorFlag = parseInt(this._popStack(), 10);
  var colors;
  var count;

  if (colorFlag === 0) {
    colors = new Float32Array(4);
    for (var i = 0; i < 4; i++){
      colors[i] = parseFloat(this._popStack());
    }
  } else if (colorFlag === 1) {
    count = this._tempResult.num_polygons * 4;
    colors = new Float32Array(count);
    for (var i = 0; i < count; i++){
      colors[i] = parseFloat(this._popStack());
    }
  } else if (colorFlag === 2) {
    count = this._tempResult.numVertices * 4;
    colors = new Float32Array(count);
    for (var i = 0; i < count; i++){
      colors[i] = parseFloat(this._popStack());
    }
  } else {
    this._tempResult.error = true;
    this._tempResult.errorMessage = "Invalid color flag: " + colorFlag;
  }

  this._tempResult.colorFlag = colorFlag;
  this._tempResult.colors = colors;
}


/**
* [PRIVATE]
* Not sure how useful endIndices are, it was used in BrainBrowser so I kept them.
* (is that useful?)
*/
MniObjReader.prototype._parseEndIndices = function() {
  var count = this._tempResult.nitems;
  var endIndices = new Uint32Array(count);

  for(var i = 0; i < count; i++){
    endIndices[i] = parseInt(this._popStack(), 10);
  }

  this._tempResult.endIndices = endIndices;
}


/**
* [PRIVATE]
* Reads the vertices indices to use to make triangles.
*/
MniObjReader.prototype._parseIndices = function() {
  var count = this._stackIndex + 1;
  var indices = new Uint32Array(count);

  for (var i = 0; i < count; i++) {
    indices[i] = parseInt(this._popStack(), 10);
  }

  this._tempResult.indices = indices;
}


/**
* [NOT USED]
* This is legacy code I left from the reader in BrainBrowser. Since splitHemispheres is
* hardcoded to false, this is not called.
*/
MniObjReader.prototype._splitHemispheres = function() {
  var numIndices = this._tempResult.indices.length;

  this._tempResult.left = {
    indices: new Uint32Array(Array.prototype.slice.call(this._tempResult.indices, 0, numIndices / 2))
  };

  this._tempResult.right = {
    indices: new Uint32Array(Array.prototype.slice.call(this._tempResult.indices, numIndices / 2))
  };
}


/**
* [PRIVATE]
* pop the raw data (big string file)
* @return {String}
*/
MniObjReader.prototype._popStack = function() {
  return this._stack[this._stackIndex--];
}


/**
* [DEBUGGING]
* @return {Object} the entire shapeData object.
*/
MniObjReader.prototype.getShapeData = function() {
  return this._shapeData;
}


/**
* @return the number of shapes encoded in the file
*/
MniObjReader.prototype.getNumberOfShapes = function() {
  return this._shapeData.shapes.length;
}


/**
* Returns the index of vertices to be used to make triangles, as a typed array.
* @return {Uint32Array} Since triangles have 3 vertices, the array contains index such as
* [i0, i1, i2, i0, i1, i2, ...].
*/
MniObjReader.prototype.getShapeRawIndices = function(shapeNum) {
  if(shapeNum >= 0 && shapeNum<this._shapeData.shapes.length){
    return this._shapeData.shapes[shapeNum].indices;
  }else{
    return null;
  }
}


/**
* Returns the vertice position as a typed array.
* @return {Float32Array} of points encoded like [x, y, z, x, y, z, ...]
*/
MniObjReader.prototype.getRawVertices = function() {
  return this._shapeData.vertices;
}


/**
* Returns the normal vectors as a typed array.
* @return {Float32Array} of normal vector encoded like [x, y, z, x, y, z, ...]
*/
MniObjReader.prototype.getRawNormals = function() {
  return this._shapeData.normals;
}


/**
* Get the colors encoded like [r, g, b, a, r, g, b, a, ...]
* @return {Float32Array} of size 4 or of size 4xnumOfVertices
*/
MniObjReader.prototype.getRawColors = function(){
  return this._shapeData.colors;
}


/**
* The surface properties contains transparency info about specularity transparency
* and other nice light-related behaviour thingies.
* May be used when building a material, but this is not mandatory.
* @return {Object}
*/
MniObjReader.prototype.getSurfaceProperties = function(){
  return this._shapeData.surfaceProperties;
}