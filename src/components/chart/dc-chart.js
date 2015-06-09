"use strict";

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

    function constructor ( root, title, units, start, end ) {
	var canves  = root.querySelector( "#chart" );
	var context = canves.getContext("2d");

	var width  = 1000; //canves.getAttribute( "width" );
	var height = 500; //canves.getAttribute( "height" );

	console.log( "width %s, height %s", width, height, canves );
	var x = d3.scale.linear()
	    .range([0, width]);

	var y = d3.scale.linear()
	    .range([height, 0]);

	var color = 'blue';

	var dot_canvas = document.createElement('canvas');
	dot_canvas.width  = 6;
	dot_canvas.height = 6;

	var dot_ctx = dot_canvas.getContext("2d");
	dot_ctx.fillStyle = "rgba(0,0,255,0.2)";
	dot_ctx.moveTo(3,3);
	dot_ctx.arc(3, 3, 2.5, 0, 2 * Math.PI);
	dot_ctx.fill();

	var data = [];
	var drawSchulded = false;

	var self = init( data, canves, context, dot_canvas, x, y, color, start, end, drawSchulded, dot_canvas, width, height );

	return self;
    }

    function init ( fData, fCanvas, fContext, fPoint, fX, fY, fColor, fStart, fEnd, fDrawSchulded, fDot, fWidth, fHeight ) {
	var self = { };
	self.updateGraph = updateGraph;

	fX.domain([fStart, fEnd]).nice();
	fY.domain([-1500,1500]).nice();

	var fAccurecy = 0;

	var zoom = d3.behavior.zoom();
	d3.select(fCanvas).call(zoom);
        zoom
	    .x(fX)
	    .on("zoom", doZoom)
	    .on("zoomend", zoomEnd)
	;

	return self;

	function doZoom ( ) {
	    var domain = fX.domain();
	    var min = domain[0];
	    var max = domain[1];
	    var range = Math.floor(((max - min)/(1000*90)/1000));
	    fAccurecy = Math.min( range, 20 );
	    schudleDraw( );
	}

	function zoomEnd  ( ) {
	    fAccurecy = 0;
	    schudleDraw( );
	}

	function updateGraph ( data ) {
	    var buffer = loadBuffer( data );
	    addData( buffer );

	    if ( fDrawSchulded == false ) {
		requestAnimationFrame(function () {
		    plotPoints([buffer], fContext, fPoint, fStart, fEnd, fX, fY, fAccurecy);
		});
	    }
	    
	}

	function schudleDraw ( ) {
	    if ( fDrawSchulded == false ) {
		fDrawSchulded = true;
		requestAnimationFrame( drawGraph );
	    }
	}

	function drawGraph ( ) {
	    fDrawSchulded = false;
	    

	    fContext.beginPath();
	    fContext.clearRect(0, 0, fWidth, fHeight);

	    plotPoints(fData, fContext, fPoint, fStart, fEnd, fX, fY, fAccurecy);
	}

	function addData ( buffer ) {
	    fData.push( buffer );
	    fData.sort( tileCmp );
	}

    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function plotPoints ( data, context, point, min, max, xScale, yScale, accuracy ) {
	var lastX   = undefined;
	var lastY   = undefined;

	var totalPoints = 0;
	var usedPoints  = 0;
	
	var domain = xScale.domain();
	var min = domain[0];
	var max = domain[1];

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

		var x = (xScale( record.time )  + 0.5) | 0;
		var y = (yScale( record.value ) + 0.5) | 0;

		if ( Math.abs(lastX - x) <= accuracy
		     && Math.abs(lastY - y) <= accuracy )
		    continue inner;

		usedPoints++;
		lastX = x;
		lastY = y;

		context.drawImage(point, x, y);
	    }

	    finishIterator( iterator );

	    
	    if ( record.time > max )
		break;
	
	}

	//console.log( "Used %d out of %d points for range %d to %d", usedPoints, totalPoints, min, max );
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


function loadGraph ( root, source, type, startDate, endDate ) {

    var startTime = startDate.getTime();
    var endTime   = endDate.getTime();
    

    var viz = Viz( root, source, type, startTime, endTime );

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
