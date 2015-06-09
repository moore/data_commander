var BUCKET_SIZE = 24 * 60 * 60 * 1000;
var requestedTimes = {};


function snapBound ( time, bucketSize ) {
    return Math.floor( time / bucketSize ) * bucketSize;
}

function makePath ( dataSource, valueType, tileTime ) {
    var result = '/data/' + dataSource + ':' + valueType + ':' + tileTime + '.tile';
    return result;
}

function getData ( source, valueType, start, end, handler ) {
    var tileStart  = snapBound( start, BUCKET_SIZE );
    var requestMax = snapBound( end, BUCKET_SIZE ) + BUCKET_SIZE ;

    getDataWorker( source, valueType, tileStart, handler );

    // Defer the spicltive work
    Promise.resolve(true).then( function () {
	getDataWorker( source, valueType, tileStart - BUCKET_SIZE, handler );
    
	for ( var i = tileStart ; i < requestMax ; i += BUCKET_SIZE ) {
	    getDataWorker( source, valueType, i, handler );
	}
    });
    
}



function getDataWorker ( source, valueType, tileStart, handler ) {
    var dataPath = makePath( source, valueType, tileStart ) ;

    if ( requestedTimes[ dataPath ] != true ) {
	doFetch( dataPath, handler );	
    }
}


var Viz = new function ( ) {
    return constructor;

    function constructor ( title, units, start, end ) {
	var svg    = document.querySelector( "#chart" );
	var points = document.querySelector( "#chart-points" );

	var width  = svg.getAttribute( "width" );
	var height = svg.getAttribute( "height" );

	var x = d3.scale.linear()
	    .range([0, width]);

	var y = d3.scale.linear()
	    .range([height, 0]);

	var color = 'blue';

	var data = [];
	var drawSchulded = false;

	var self = init( data, svg, points, x, y, color, start, end, drawSchulded );

	return self;
    }

    function init ( fData, fSvg, fPoints, fX, fY, fColor, fStart, fEnd, fDrawSchulded ) {
	var self = { };
	self.updateGraph = updateGraph;

	fX.domain([fStart, fEnd]).nice();

	return self;

	function updateGraph ( data ) {
	    addData( data );
	    if ( fDrawSchulded == false ) {
		fDrawSchulded = true;
		requestAnimationFrame(drawGraph);
	    }
	}

	function drawGraph ( ) {
	    fDrawSchulded = false;
	    
	    fY.domain([-1500,1500]).nice();

	    var path = makePath2(fData, fStart, fEnd, fX, fY, 5, 2);

	    fPoints.setAttribute( "d", path );
	}

	function addData ( tile ) {
	    var buffer = loadBuffer( tile );
	    fData.push( buffer );
	    fData.sort( tileCmp );
	}

    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function makePath2 ( data, min, max, xScale, yScale, accuracy, persion ) {
	var path    = "";
	var lastX   = undefined;
	var lastY   = undefined;

	var totalPoints = 0;
	var usedPoints  = 0;

	for ( var i = 0 ; i < data.length ; i++ ) {

	    var buffer   = data[i];
	    var iterator = initIterator( buffer );

	    var record = { time : undefined, value : undefined };

	    inner:
	    while ( nextValue( iterator, buffer, record ) ) {

		totalPoints++;

		if (  record.time > max )
		    break inner;

		if (  record.time <= min )
		    continue inner;

		var x = xScale( record.time );
		var y = yScale( record.value );

		if ( Math.abs(lastX - x) <= accuracy
		     && Math.abs(lastY - y) <= accuracy )
		    continue inner;

		usedPoints++;
		lastX = x;
		lastY = y;


		path += "M";
		path += x;
		path += ",";
		path += y;
		path += "L";
		path += x;
		path += ",";
		path += y;
	    }

	    finishIterator( iterator );

	    if ( record.time > max )
		break;
	}

	console.log( "used %d out of %d points", usedPoints, totalPoints ); //BOOG
	return path;
    }

}



var doFetch = new function () {
    var queue       = [ ];
    var outstanding = 0;
    var MAX = 10;

    return doFetch;

    function doFetch ( file, handler ) {
	if ( outstanding >= MAX )
	    queue.push( [file, handler] );

	else
	    doFetchWorker( file, handler );
    }

    function done () {
	outstanding--;
	if ( outstanding < MAX && queue.length > 0 )  {
	    var next = queue.shift();
	    doFetchWorker( next[0], next[1] );
	}
    }

    function doFetchWorker ( file, handler ) {
	outstanding++;
	requestedTimes[ file ] = true;
	fetch(file)  
	    .then( function(response) { 
		if (response.status !== 200) {  
		    console.log('Looks like there was a problem. Status Code: ' +  
				response.status);
		    done();
		    return;  
		}

		response.arrayBuffer()
		    .then(finish)
		    .catch(function(err) {
			done();
			console.log("processing array buffer for %s:",file,  err);
		    });  
	    } )  
	    .catch(function(err) {
		done();
		console.log('Fetch Error :-S', err);  
	    });

	function finish ( data ) {
	    done();
	    handler(data);
	}
    }
}


function loadGraph ( source, type, startDate, endDate ) {

    var startTime = startDate.getTime();
    var endTime   = endDate.getTime();
    

    var viz = Viz( source, type, startTime, endTime );

    getMyData( startTime, endTime );

    return;

    function getMyData ( startTime, endTime ) {
	if ( startTime != 0 ) //BUG: wont work for epoc tile
	    getData( source, type, startTime, endTime, handleData );
    }

    function handleData ( tile ) {
	viz.updateGraph( tile );
    }
}
