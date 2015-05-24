two_times = Module.cwrap('two_times')

function loadBuffer ( arrayBuffer ) {
    var buf = Module._malloc(
	arrayBuffer.length * arrayBuffer.BYTES_PER_ELEMENT);
    Module.HEAPU8.set(arrayBuffer, buf);
    return buf;
}

initIterator   = Module.cwrap('initIterator');
nextValue      = Module.cwrap('nextValue');
finishIterator = Module.cwrap('finishIterator');

function freeBuffer ( buf ) {
    Module._free(buf);
}
