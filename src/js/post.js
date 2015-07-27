function loadBuffer ( arrayBuffer ) {
    var bytes = new Uint8Array( arrayBuffer );
    var nDataBytes = bytes.length * bytes.BYTES_PER_ELEMENT;
    var ptr = Module._malloc(nDataBytes);
    var dataHeap = new Uint8Array(Module.HEAPU8.buffer, ptr, nDataBytes);
    dataHeap.set(bytes);

    return ptr;
}

var readIndexStart   = Module.cwrap('readIndexStart'  , 'number', ['number']);
var initIterator     = Module.cwrap('initIterator'    , null    , ['number']);
var nextValue        = Module.cwrap('nextValue'       , 'number', ['number', 'number']);
var finishIterator   = Module.cwrap('finishIterator'  , null    , ['number']);
var readValue        = Module.cwrap('readValue'       , 'number', ['number', 'number']);
var _getName         = Module.cwrap('getName'         , 'number', ['number', 'number']);
var _getNameLength   = Module.cwrap('getNameLength'   , 'number', ['number', 'number']);
var _getUnits        = Module.cwrap('getUnits'        , 'number', ['number', 'number']);
var _getUnitsLength  = Module.cwrap('getUnitsLength'  , 'number', ['number', 'number']);
var getColumCount    = Module.cwrap('getColumCount'   , 'number', ['number']);
var readColumnMin    = Module.cwrap('readColumnMin'   , 'number', ['number', 'number']);
var readColumnMax    = Module.cwrap('readColumnMax'   , 'number', ['number', 'number']);
var readEntriesCount = Module.cwrap('readEntriesCount', 'number', ['number', 'number']);

function readName ( iterator, index ) {
    var ptr    = _readName( iterator, index );
    var strLen = _readNameLength( initIterator, index );

    return Module.Pointer_stringify( ptr, strLen );
}

function getNames ( iterator ) {
    var result = {};
    var columnCount = getColumCount( iterator );

    for ( var i = 0 ; i < columnCount ; i++ ) {
	var name = readName( iterator, i );
	result[ name ] = i;
    }

    return result;
}

function readUnits ( iterator, index ) {
    var ptr    = _readUnits( iterator, index );
    var strLen = _readUnitsLength( initIterator, index );

    return Module.Pointer_stringify( ptr, strLen );
}


function freeBuffer ( buf ) {
    Module._free(buf);
}
