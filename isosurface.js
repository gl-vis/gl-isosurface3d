"use strict";

var LOG_TIMINGS = false;

var computeVertexNormals = require('./lib/computeVertexNormals').computeVertexNormals;
var geoTable = require('./lib/geoTable');
var normalTable = require('./lib/normalTable');
var createTriMesh = require('./lib/trimesh');

exports = module.exports = function(params, bounds) {
	if (params.logTimings) {
		LOG_TIMINGS = true;
	}
	var dims = params.dimensions;
	var data = params.values;
	var isoBounds = params.isoBounds || [1, Infinity];
	var isoMin = isoBounds[0], isoMax = isoBounds[1];
	var isosurf = marchingCubesSurfaces(dims, data, isoMin, isoMax, bounds);
	if (params.smoothNormals) {
		smoothNormals(isosurf);
	}
	var isocapsMesh;
	if (params.isoCaps) {
		var isocaps = marchingCubesAllCaps(dims, data, isoMin, isoMax, bounds);
		if (params.singleMesh) {
			isosurf = concatMeshes(isosurf, isocaps);
		} else {
			isocapsMesh = meshConvert(
				isocaps,
				data,
				dims,
				params.capsVertexIntensityBounds || params.vertexIntensityBounds,
				params.meshgrid
			);
			isocapsMesh.colormap = params.capsColormap || params.colormap;
		}
	}
	var isoPlot = meshConvert(
		isosurf,
		data,
		dims,
		params.vertexIntensityBounds,
		params.meshgrid
	);
	isoPlot.colormap = params.colormap;
	if (isocapsMesh) {
		isoPlot.caps = isocapsMesh;
	}
	if (params.logTimings) {
		LOG_TIMINGS = false;
	}
	return isoPlot;
};

exports.createTriMesh = createTriMesh;

var geoLengthTable = geoTable.map(function(a) { return a.length });

var getVerticesAndNormals = function(geoIndices, vertexCount, dims, bounds) {

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);

	var x, y, z;
	var xStart = bounds[0][0], yStart = bounds[0][1], zStart = bounds[0][2];
	var xEnd   = bounds[1][0], yEnd   = bounds[1][1], zEnd   = bounds[1][2];
	xEnd--; yEnd--; zEnd--;

	var i = 0, j = 0;
	// March over the volume
	for (z = zStart; z < zEnd; z++) {
		for (y = yStart; y < yEnd; y++) {
			for (x = xStart; x < xEnd; x++) {

				var id = geoIndices[i];
				var vTable = geoTable[id];
				var nTable = normalTable[id];

				var len = vTable.length;
				for (var n = 0; n < len; n += 3) {
					vertices[j + 0] = vTable[n + 0] + x;
					vertices[j + 1] = vTable[n + 1] + y;
					vertices[j + 2] = vTable[n + 2] + z;

					normals[j + 0] = nTable[n + 0];
					normals[j + 1] = nTable[n + 1];
					normals[j + 2] = nTable[n + 2];

					j += 3;
				}
				i += 1;
			}
		}
	}

	return {
		vertices: vertices,
		normals: normals
	};
}

var buildGeoIndices = function(data, dims, bounds) {
	var x, y, z;
	var width = dims[0], height = dims[1];
	var xStart = bounds[0][0], yStart = bounds[0][1], zStart = bounds[0][2];
	var xEnd = bounds[1][0], yEnd = bounds[1][1], zEnd = bounds[1][2];
	var zStride = width * height;
	var yStride = width;
	xEnd--; yEnd--; zEnd--;

	var vertexCount = 0;
	var n = 0;

	var zOff, yOff00, yOff01, yOff10, yOff11;
	var s1, s3, s5, s7;

	var geoIndices = new Uint8Array((xEnd - xStart) * (yEnd - yStart) * (zEnd - zStart));

	// March over the volume
	for (z = zStart; z < zEnd; z++) {
		zOff = z * zStride;
		for (y = yStart; y < yEnd; y++) {
			yOff00 = zOff + y * yStride + xStart;
			yOff01 = yOff00 + yStride;
			yOff10 = yOff00 + zStride;
			yOff11 = yOff01 + zStride;

			// For each cell, compute cube index

			s1 = data[yOff00++];
			s3 = data[yOff01++];
			s5 = data[yOff10++];
			s7 = data[yOff11++];

			for (x = xStart; x < xEnd - 4; x += 4, n += 4) {
				var c = [0, 0, 0, 0];
				for (var i = 0; i < 4; ++i) {
					c[i] += s1*1;
					c[i] += s3*4;
					c[i] += s5*16;
					c[i] += s7*64;
					s1 = data[yOff00++];
					s3 = data[yOff01++];
					s5 = data[yOff10++];
					s7 = data[yOff11++];
					c[i] += s1*2;
					c[i] += s3*8;
					c[i] += s5*32;
					c[i] += s7*128;
				}
				geoIndices[n + 0] = c[0];
				geoIndices[n + 1] = c[1];
				geoIndices[n + 2] = c[2];
				geoIndices[n + 3] = c[3];

				vertexCount += geoLengthTable[c[0]];
				vertexCount += geoLengthTable[c[1]];
				vertexCount += geoLengthTable[c[2]];
				vertexCount += geoLengthTable[c[3]];
			}
			for (; x<xEnd; x++, n++) {
				var d = 0;

				d += s1*1;
				d += s3*4;
				d += s5*16;
				d += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				d += s1*2;
				d += s3*8;
				d += s5*32;
				d += s7*128;

				geoIndices[n] = d;
				vertexCount += geoLengthTable[d];
			}
		}
	}

	return {
		geoIndices: geoIndices,
		vertexCount: vertexCount
	};
}

function munchData(data, isoMin, isoMax) {

	function calMunchedData(a) {
		return (data[a] >= isoMin && data[a] <= isoMax) ? 1 : 0;
	}


	var munchedData = new Uint8Array(data.length);

	var i = 0, s = 0, dl8 = data.length - 8;
	for (i = 0; i < dl8; i += 8) {
		for (var j = 0; j < 8; ++j) {
			munchedData[i+j] = calMunchedData(i+j)
		}
	}
	for (; i < data.length; i++) {
		munchedData[i + 0] = calMunchedData(i + 0)
	}

	return munchedData;
}


function marchingCubesSurfaces(dims, data, isoMin, isoMax, bounds) {

	if (LOG_TIMINGS) {
		console.log('---');
		console.time('marchingCubes');
	}
	if (!bounds) {
		bounds = [[0,0,0], dims];
	}

	if (LOG_TIMINGS) {
		console.time("Munch data");
	}

	var munchedData = munchData(data, isoMin, isoMax);

	if (LOG_TIMINGS) {
		console.timeEnd("Munch data");

		console.time("construct cube indices");
	}

	var result = buildGeoIndices(munchedData, dims, bounds);
    var geoIndices = result.geoIndices;
	var vertexCount = result.vertexCount;

	if (LOG_TIMINGS) {
		console.timeEnd("construct cube indices");

		console.time("Fill vertex arrays");
	}

	var arrays = getVerticesAndNormals(geoIndices, vertexCount, dims, bounds);
	var vertices = arrays.vertices;
	var normals = arrays.normals;

	if (LOG_TIMINGS) {
		console.timeEnd("Fill vertex arrays");

		console.timeEnd('marchingCubes');
	}
	return {vertices: vertices, normals: normals};
};

function marchingCubesCap(axis, dir, dims, data, isoMin, isoMax, bounds) {

	var cap = (dir === -1) ? bounds[0][axis] : bounds[1][axis]-1;

	var width = dims[0], height = dims[1];
	var xStart = bounds[0][0], yStart = bounds[0][1], zStart = bounds[0][2];
	var xEnd = bounds[1][0], yEnd = bounds[1][1], zEnd = bounds[1][2];

	var bw = (axis === 0) ? 2 : xEnd - xStart;
	var bh = (axis === 1) ? 2 : yEnd - yStart;
	var bd = (axis === 2) ? 2 : zEnd - zStart;

	var off1 = 0;
	var off2 =
		(axis === 0) ? 1 :
		(axis === 1) ? bw :
					   bw*bh;

	if (dir === -1) {
        var tmp = off1;
		off1 = off2;
		off2 = tmp;
	}

	var dataSlice = new Uint8Array(bw*bh*bd);

	for (var z=zStart; z<zStart+bd; z++) {
		for (var y=yStart; y<yStart+bh; y++) {
			for (var x=xStart; x<xStart+bw; x++) {

				var off =
					(axis === 0) ? z*width*height + y*width :
		            (axis === 1) ? z*width*height + x :
			  					   y*width + x;

				var index =
					(axis === 0) ? cap :
				    (axis === 1) ? cap*width :
				                   cap*width*height;

				var v = data[index + off];

				var begin =
					(axis === 0) ? (z - zStart)*bw*bh + (y - yStart)*bw :
					(axis === 1) ? (z - zStart)*bw*bh + (x - xStart) :
					               (y - yStart)*bw + (x - xStart);

				dataSlice[begin + off1] = 0;
				dataSlice[begin + off2] = (v >= isoMin && v <= isoMax) ? 1 : 0;
			}
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];

	var result = buildGeoIndices(dataSlice, sliceDims, bounds);
	var geoIndices = result.geoIndices;
	var vertexCount = result.vertexCount;

	var arrays = getVerticesAndNormals(geoIndices, vertexCount, dims, bounds);
	var vertices = arrays.vertices;
	var normals = arrays.normals;

	for (var i=0; i<vertices.length; i+=3) {
		vertices[i + 0] = (axis === 0) ? cap : vertices[i + 0] + xStart;
		vertices[i + 1] = (axis === 1) ? cap : vertices[i + 1] + yStart;
		vertices[i + 2] = (axis === 2) ? cap : vertices[i + 2] + zStart;

		normals[i + 0] = (axis === 0) ? dir : 0;
		normals[i + 1] = (axis === 1) ? dir : 0;
		normals[i + 2] = (axis === 2) ? dir : 0;
	}

	return {vertices: vertices, normals: normals};
}

function concatMeshes() {
	if (LOG_TIMINGS) {
		console.time('concatMeshes');
	}
	var len = 0;
	for (var i=0; i<arguments.length; i++) {
		len += arguments[i].vertices.length;
	}
	var vertices = new Float32Array(len);
	var normals = new Float32Array(len);
	var count = 0;
	for (var i=0; i<arguments.length; i++) {
		var mesh = arguments[i];
		var v = mesh.vertices;
		var n = mesh.normals;
		vertices.set(v, count);
		normals.set(n, count);
		count += v.length;
	}
	if (LOG_TIMINGS) {
		console.timeEnd('concatMeshes');
	}
	return {vertices: vertices, normals: normals};
}

function marchingCubesAllCaps(dims, data, isoMin, isoMax, bounds) {
	if (LOG_TIMINGS) {
		console.time('isoCaps');
	}

	var mesh = concatMeshes(
		marchingCubesCap(0, -1, dims, data, isoMin, isoMax, bounds),
		marchingCubesCap(0, +1, dims, data, isoMin, isoMax, bounds),
		marchingCubesCap(1, -1, dims, data, isoMin, isoMax, bounds),
		marchingCubesCap(1, +1, dims, data, isoMin, isoMax, bounds),
		marchingCubesCap(2, -1, dims, data, isoMin, isoMax, bounds),
		marchingCubesCap(2, +1, dims, data, isoMin, isoMax, bounds)
	);
	if (LOG_TIMINGS) {
		console.timeEnd('isoCaps');
	}
	return mesh;
};

function smoothNormals(mesh) {
	var vertices = mesh.vertices, normals = mesh.normals;
	if (LOG_TIMINGS) {
		console.time('computeVertexNormals');
	}
	computeVertexNormals(vertices, normals, normals);
	if (LOG_TIMINGS) {
		console.timeEnd('computeVertexNormals');
	}
	return mesh;
};

function meshConvert(mesh, data, dims, vertexIntensityBounds, meshgrid) {
	if (LOG_TIMINGS) {
		console.time('meshConvert');
	}
	var vertices = mesh.vertices, normals = mesh.normals;
	var w = dims[0], h = dims[1];
	var vertexIntensity = new Float32Array(vertices.length / 3);
	var len = vertices.length;
	for (var i = 0; i < len / 3; i++) {
		var x = vertices[i * 3 + 0];
		var y = vertices[i * 3 + 1];
		var z = vertices[i * 3 + 2];
		vertexIntensity[i] = data[z*h*w + y*w + x];
		if (meshgrid) {
			vertices[i * 3 + 0] = meshgrid[0][x];
			vertices[i * 3 + 1] = meshgrid[1][y];
			vertices[i * 3 + 2] = meshgrid[2][z];
		}
	}
	var geo = {
		positions: vertices,
		vertexNormals: normals,
		vertexIntensity: vertexIntensity,
		vertexIntensityBounds: vertexIntensityBounds
	};
	if (LOG_TIMINGS) {
		console.timeEnd('meshConvert');
	}
	return geo;
};
