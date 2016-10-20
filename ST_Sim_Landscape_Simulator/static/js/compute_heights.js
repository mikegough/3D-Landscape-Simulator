// computeHeights.js
// Moves the decoding of the heights off the UI

var onmessage = function(e) {
	postMessage(computeHeights(e.data.w, e.data.h, e.data.data))
};

function computeHeights(w,h,data) {
	var idx;
	var heights = new Float32Array(w * h);
	for (var y = 0; y < h; ++y) {
		for (var x = 0; x < w; ++x) {
			idx = (x + y * w) * 4;
			heights[x + y * w] = (data[idx] | (data[idx+1] << 8) | (data[idx+2] << 16)) + data[idx+3] - 255;
		}
	}

	return heights
}
