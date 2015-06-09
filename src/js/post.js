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
var _nextValue     = Module.cwrap('nextValue');
var finishIterator = Module.cwrap('finishIterator');
var readValue      = Module.cwrap('readValue');
var readTime       = Module.cwrap('readTime');

function nextValue ( iterator, buffer, result ) {
    var error = _nextValue( buffer, iterator );
    result.value = readValue( iterator );
    result.time  = readTime( iterator );

    return error == 0 ? false : true ;
}

function freeBuffer ( buf ) {
    Module._free(buf);
}
