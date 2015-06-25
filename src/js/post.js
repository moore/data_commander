function loadBuffer ( arrayBuffer ) {
    var bytes = new Uint8Array( arrayBuffer );
    var nDataBytes = bytes.length * bytes.BYTES_PER_ELEMENT;
    var ptr = Module._malloc(nDataBytes);
    var dataHeap = new Uint8Array(Module.HEAPU8.buffer, ptr, nDataBytes);
    dataHeap.set(bytes);

    return ptr;
}

var readStartTime  = Module.cwrap('readStartTime');
var initIterator   = Module.cwrap('initIterator');
var nextValue      = Module.cwrap('nextValue');
var finishIterator = Module.cwrap('finishIterator');
var readValue      = Module.cwrap('readValue');
var readTime       = Module.cwrap('readTime');
var readVariance1  = Module.cwrap('readVariance1');


function freeBuffer ( buf ) {
    Module._free(buf);
}
