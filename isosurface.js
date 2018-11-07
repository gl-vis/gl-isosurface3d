"use strict";

var LOG_TIMINGS = false;

var computeVertexNormals = require('./lib/computeVertexNormals').computeVertexNormals
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
	var isosurf = marchingCubes(dims, data, isoMin, isoMax, bounds)
	if (params.smoothNormals) {
		smoothNormals(isosurf);
	}
	var isocapsMesh;
	if (params.isoCaps) {
		var isocaps = marchingCubesCaps(dims, data, isoMin, isoMax, bounds);
		if (params.singleMesh) {
			isosurf = concatMeshes(isosurf, isocaps);
		} else {
			isocapsMesh = meshConvert(isocaps, data, dims, params.capsVertexIntensityBounds || params.vertexIntensityBounds, params.meshgrid);
			isocapsMesh.colormap = params.capsColormap || params.colormap;
		}
	}
	var isoPlot = meshConvert(isosurf, data, dims, params.vertexIntensityBounds, params.meshgrid);
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

var fillVertexArrays = function(geoIndices, vertices, normals, dims, bounds) {
	var idx, verts, norms;
	var x, y, z;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];
	var zStride = width * height;
	var yStride = width;
	ex--; ey--; ez--;

	var i=0, j=0, k=0, w=0, u=0, vl=0;
	// March over the volume
	for (z=sz; z<ez; z++) {
		for (y=sy; y<ey; y++) {
			for (x=sx; x<ex; x++, j++) {

				idx = geoIndices[j];
				verts = geoTable[idx];
				norms = normalTable[idx];

				vl = verts.length;

				for (i=0,u=0; i<vl;) {
					for (var q = 0; q < 3; ++q) { // do this three times.
						normals[w++] = norms[u++];
						normals[w++] = norms[u++];
						normals[w++] = norms[u++];

						vertices[k++] = verts[i++] + x;
						vertices[k++] = verts[i++] + y;
						vertices[k++] = verts[i++] + z;
					}
				}
			}
		}
	}
}

var buildGeoIndices = function(data, dims, bounds) {
	var x, y, z;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];
	var zStride = width * height;
	var yStride = width;
	ex--; ey--; ez--;
	var ex4 = ex-4;

	var vertexCount = 0;
	var n = 0;

	var zOff, yOff00, yOff01, yOff10, yOff11;
	var s1, s3, s5, s7;

	var geoIndices = new Uint8Array((ex - sx) * (ey - sy) * (ez - sz));

	// March over the volume
	for (z=sz; z<ez; z++) {
		zOff = z * zStride;
		for (y=sy; y<ey; y++) {
			yOff00 = zOff + y * yStride + sx;
			yOff01 = yOff00 + yStride;
			yOff10 = yOff00 + zStride;
			yOff11 = yOff01 + zStride;

			// For each cell, compute cube index

			s1 = data[yOff00++];
			s3 = data[yOff01++];
			s5 = data[yOff10++];
			s7 = data[yOff11++];

			for (x=sx; x<ex4; x+=4, n+=4) {
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
				geoIndices[n+0] = c[0];
				geoIndices[n+1] = c[1];
				geoIndices[n+2] = c[2];
				geoIndices[n+3] = c[3];

				vertexCount += geoLengthTable[c[0]];
				vertexCount += geoLengthTable[c[1]];
				vertexCount += geoLengthTable[c[2]];
				vertexCount += geoLengthTable[c[3]];
			}
			for (; x<ex; x++, n++) {
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

	var munchedData = new Uint8Array(data.length);

	var i = 0, s = 0, dl8 = data.length - 8;
	for (i = 0; i < dl8; i += 8) {
		for (var j = 0; j < 8; ++j) {
			munchedData[i+j] = (data[i+j] >= isoMin && data[i+j] <= isoMax) ? 1 : 0;
		}
	}
	for (; i < data.length; i++) {
		munchedData[i+0] = (data[i+0] >= isoMin && data[i+0] <= isoMax) ? 1 : 0;
	}

	return munchedData;
}


function marchingCubes(dims, data, isoMin, isoMax, bounds) {

	if (LOG_TIMINGS) {
		console.log('---');
		console.time('marchingCubes');
	}
	if (!bounds) {
		bounds = [[0,0,0], dims];
	}

	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

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

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);

	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);

	if (LOG_TIMINGS) {
		console.timeEnd("Fill vertex arrays");

		console.timeEnd('marchingCubes');
	}
	return {vertices: vertices, normals: normals};
};

function marchingCubeCapXYZ(axis, dims, data, isoMin, isoMax, bounds, dir) {

	var cap = (dir === -1) ? bounds[0][axis] : bounds[1][axis]-1;

	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = (axis === 0) ? 2 : ex - sx;
	var bh = (axis === 1) ? 2 : ey - sy;
	var bd = (axis === 2) ? 2 : ez - sz;

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

	for (var z=sz; z<sz+bd; z++) {
		for (var y=sy; y<sy+bh; y++) {
			for (var x=sx; x<sx+bw; x++) {

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
					(axis === 0) ? (z - sz)*bw*bh + (y - sy)*bw :
					(axis === 1) ? (z - sz)*bw*bh + (x - sx) :
					               (y - sy)*bw + (x - sx);

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

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);

	for (var i=0; i<vertices.length; i+=3) {
		vertices[i  ] = (axis === 0) ? cap : vertices[i  ] + sx;
		vertices[i+1] = (axis === 1) ? cap : vertices[i+1] + sy;
		vertices[i+2] = (axis === 2) ? cap : vertices[i+2] + sz;

		normals[i  ] = (axis === 0) ? dir : 0;
		normals[i+1] = (axis === 1) ? dir : 0;
		normals[i+2] = (axis === 2) ? dir : 0;
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

function marchingCubesCaps(dims, data, isoMin, isoMax, bounds) {
	if (LOG_TIMINGS) {
		console.time('isoCaps');
	}

	var mesh = concatMeshes(
		marchingCubeCapXYZ(0, dims, data, isoMin, isoMax, bounds, -1),
		marchingCubeCapXYZ(0, dims, data, isoMin, isoMax, bounds, 1),
		marchingCubeCapXYZ(1, dims, data, isoMin, isoMax, bounds, -1),
		marchingCubeCapXYZ(1, dims, data, isoMin, isoMax, bounds, 1),
		marchingCubeCapXYZ(2, dims, data, isoMin, isoMax, bounds, -1),
		marchingCubeCapXYZ(2, dims, data, isoMin, isoMax, bounds, 1)
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
	var w = dims[0], h = dims[1], d = dims[2];
	var vertexIntensity = new Float32Array(vertices.length / 3);
	for (var j = 0, i = 0; j < vertices.length; j+=3, i++) {
		var x = vertices[j];
		var y = vertices[j+1];
		var z = vertices[j+2];
		vertexIntensity[i] = data[z*h*w + y*w + x];
		if (meshgrid) {
			vertices[j    ] = meshgrid[0][x];
			vertices[j + 1] = meshgrid[1][y];
			vertices[j + 2] = meshgrid[2][z];
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
