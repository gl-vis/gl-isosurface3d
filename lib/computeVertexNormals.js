"use strict";

exports.computeVertexNormals = function(vertices, normals, dst) {
	if (dst === undefined) {
		dst = new Float32Array(normals.length);
	}
	var vertexNormals = {};
	for (var i=0; i<vertices.length; i+=3) {
		var key = (vertices[i+2] << 20) + (vertices[i+1] << 10) + vertices[i];
		if (vertexNormals[key] === undefined) {
			vertexNormals[key] = [0,0,0];
		}
		var nml = vertexNormals[key];
		nml[0] += normals[i];
		nml[1] += normals[i+1];
		nml[2] += normals[i+2];
	}
	for (var i=0; i<vertices.length; i+=3) {
		var key = (vertices[i+2] << 20) + (vertices[i+1] << 10) + vertices[i];
		var nml = vertexNormals[key];
		dst[i] = nml[0];
		dst[i+1] = nml[1];
		dst[i+2] = nml[2];
	}
	return dst;
};