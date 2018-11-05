"use strict";

var createTriMesh = require('./lib/trimesh');

var LOG_TIMINGS = false;

exports = module.exports = function(params, bounds) {
	if (params.logTimings) {
		LOG_TIMINGS = true;
	}
	var dims = params.dimensions;
	var data = params.values;
	var isoBounds = params.isoBounds || [1, Infinity];
	var isoMin = isoBounds[0], isoMax = isoBounds[1];
	var isosurf = exports.marchingCubes(dims, data, isoMin, isoMax, bounds)
	if (params.smoothNormals) {
		exports.smoothNormals(isosurf);
	}
	var isocapsMesh;
	if (params.isoCaps) {
		var isocaps = exports.marchingCubesCaps(dims, data, isoMin, isoMax, bounds);
		if (params.singleMesh) {
			isosurf = exports.concatMeshes(isosurf, isocaps);
		} else {
			isocapsMesh = exports.meshConvert(isocaps, data, dims, params.capsVertexIntensityBounds || params.vertexIntensityBounds, params.meshgrid);
			isocapsMesh.colormap = params.capsColormap || params.colormap;
		}
	}
	var isoPlot = exports.meshConvert(isosurf, data, dims, params.vertexIntensityBounds, params.meshgrid);
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

var computeVertexNormals = require('./lib/computeVertexNormals').computeVertexNormals

var geoTable = require('./lib/geoTable');
var normalTable = require('./lib/normalTable');

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

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

				}
			}
		}
	}
}


var buildGeoIndices = function(geoIndices, data, dims, bounds) {
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
	var c0, c1, c2, c3;

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
				c0 = 0, c1 = 0, c2 = 0, c3 = 0;

				c0 += s1*1;
				c0 += s3*4;
				c0 += s5*16;
				c0 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c0 += s1*2;
				c0 += s3*8;
				c0 += s5*32;
				c0 += s7*128;

				c1 += s1*1;
				c1 += s3*4;
				c1 += s5*16;
				c1 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c1 += s1*2;
				c1 += s3*8;
				c1 += s5*32;
				c1 += s7*128;

				c2 += s1*1;
				c2 += s3*4;
				c2 += s5*16;
				c2 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c2 += s1*2;
				c2 += s3*8;
				c2 += s5*32;
				c2 += s7*128;

				c3 += s1*1;
				c3 += s3*4;
				c3 += s5*16;
				c3 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c3 += s1*2;
				c3 += s3*8;
				c3 += s5*32;
				c3 += s7*128;

				geoIndices[n+0] = c0;
				geoIndices[n+1] = c1;
				geoIndices[n+2] = c2;
				geoIndices[n+3] = c3;

				vertexCount += geoLengthTable[c0];
				vertexCount += geoLengthTable[c1];
				vertexCount += geoLengthTable[c2];
				vertexCount += geoLengthTable[c3];
			}
			for (; x<ex; x++, n++) {
				c0 = 0, c1 = 0, c2 = 0, c3 = 0;

				c0 += s1*1;
				c0 += s3*4;
				c0 += s5*16;
				c0 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c0 += s1*2;
				c0 += s3*8;
				c0 += s5*32;
				c0 += s7*128;

				geoIndices[n+0] = c0;
				vertexCount += geoLengthTable[c0];
			}
		}
	}

	return vertexCount;
}

function munchData(data, isoMin, isoMax) {
	if (data2.length < data.length) {
		data2 = new Uint8Array(data.length);
	}
	var i = 0, s = 0, dl8 = data.length - 8;
	for (i = 0; i < dl8; i += 8) {
		data2[i+0] = (data[i+0] >= isoMin && data[i+0] <= isoMax) ? 1 : 0;
		data2[i+1] = (data[i+1] >= isoMin && data[i+1] <= isoMax) ? 1 : 0;
		data2[i+2] = (data[i+2] >= isoMin && data[i+2] <= isoMax) ? 1 : 0;
		data2[i+3] = (data[i+3] >= isoMin && data[i+3] <= isoMax) ? 1 : 0;
		data2[i+4] = (data[i+4] >= isoMin && data[i+4] <= isoMax) ? 1 : 0;
		data2[i+5] = (data[i+5] >= isoMin && data[i+5] <= isoMax) ? 1 : 0;
		data2[i+6] = (data[i+6] >= isoMin && data[i+6] <= isoMax) ? 1 : 0;
		data2[i+7] = (data[i+7] >= isoMin && data[i+7] <= isoMax) ? 1 : 0;
	}
	for (; i < data.length; i++) {
		data2[i+0] = (data[i+0] >= isoMin && data[i+0] <= isoMax) ? 1 : 0;
	}
}


var data2 = new Uint8Array(1000000);
var geoIndices = new Uint8Array(1000000);

exports.marchingCubes = function(dims, data, isoMin, isoMax, bounds) {
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

	munchData(data, isoMin, isoMax);

	if (LOG_TIMINGS) {
		console.timeEnd("Munch data");

		console.time("construct cube indices");
	}

	var geoIndicesLength = (ez-sz-1)*(ey-sy-1)*(ex-sx-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, data2, dims, bounds);

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

exports.marchingCubeCapX = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capX = dir === -1 ? bounds[0][0] : bounds[1][0]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = 2;
	var bh = ey-sy;
	var bd = ez-sz;

	var off1 = 0, off2 = 1;
	if (dir === -1) {
		off1 = 1;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var z=sz,dz=0; z<ez; z++,dz++) {
		for (var y=sy,dy=0; y<ey; y++,dy++) {
			var off = z * zStride + y * width;
			var v = data[off + capX];
			dataSlice[off1 + dz*bw*bh + dy*bw] = 0;
			dataSlice[off2 + dz*bw*bh + dy*bw] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] = capX;
		vertices[i+1] += sy;
		vertices[i+2] += sz;
		normals[i] = dir;
		normals[i+1] = 0;
		normals[i+2] = 0;
	}

	return {vertices: vertices, normals: normals};
}

exports.marchingCubeCapY = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capY = dir === -1 ? bounds[0][1] : bounds[1][1]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = ex-sx;
	var bh = 2;
	var bd = ez-sz;

	var off1 = 0, off2 = bw;
	if (dir === -1) {
		off1 = bw;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var z=sz,dz=0; z<ez; z++,dz++) {
		for (var x=sx,dx=0; x<ex; x++,dx++) {
			var off = z * zStride + x;
			var v = data[off + width*capY];
			dataSlice[off1 + dz*bw*bh + dx] = 0;
			dataSlice[off2 + dz*bw*bh + dx] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] += sx;
		vertices[i+1] = capY;
		vertices[i+2] += sz;
		normals[i] = 0;
		normals[i+1] = dir;
		normals[i+2] = 0;
	}

	return {vertices: vertices, normals: normals};
}

exports.marchingCubeCapZ = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capZ = dir === -1 ? bounds[0][2] : bounds[1][2]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = ex-sx;
	var bh = ey-sy;
	var bd = 2;

	var off1 = 0, off2 = bh*bw;
	if (dir === -1) {
		off1 = bh*bw;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var y=sy,dy=0; y<ey; y++,dy++) {
		for (var x=sx,dx=0; x<ex; x++,dx++) {
			var off = y * width + x;
			var v = data[off + zStride*capZ];
			dataSlice[off1 + dy*bw + dx] = 0;
			dataSlice[off2 + dy*bw + dx] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] += sx;
		vertices[i+1] += sy;
		vertices[i+2] = capZ;
		normals[i] = 0;
		normals[i+1] = 0;
		normals[i+2] = dir;
	}

	return {vertices: vertices, normals: normals};
}

exports.concatMeshes = function() {
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

exports.marchingCubesCaps = function(dims, data, isoMin, isoMax, bounds) {
	if (LOG_TIMINGS) {
		console.time('isoCaps');
	}
	var mesh = exports.concatMeshes(
		exports.marchingCubeCapX(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapX(dims, data, isoMin, isoMax, bounds, 1),
		exports.marchingCubeCapY(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapY(dims, data, isoMin, isoMax, bounds, 1),
		exports.marchingCubeCapZ(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapZ(dims, data, isoMin, isoMax, bounds, 1)
	);
	if (LOG_TIMINGS) {
		console.timeEnd('isoCaps');
	}
	return mesh;
};

exports.smoothNormals = function(mesh) {
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

exports.meshConvert = function(mesh, data, dims, vertexIntensityBounds, meshgrid) {
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
