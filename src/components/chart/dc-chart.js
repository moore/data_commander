"use strict";

var BUCKET_SIZE = 24 * 60 * 60 * 1000;
var requestedTimes = {};

// register a new element called proto-element
Polymer({
    is: "dc-chart",
    properties: {
	source: {
            type : String,
            value: ""
	},
	data: {
            type : String,
            value: ""
	},
	start: {
            type : Date,
            value: new Date(Date.now() - 1000 * 60 * 60 * 24)
	},
	end: {
            type : Date,
            value: new Date()
	},
	yZoom: {
            type    : Number,
            value   : 100,
            observer: '_yZoomChanged'      
	},
    },
    // add a callback to the element's prototype
    ready: function() {
	this.viz = loadGraph( this, this.source, this.data, this.start, this.end );
    },

    _yZoomChanged: function ( newZoom, oldZoom ) {
	console.log( "Zoom zoom zoom:", oldZoom, newZoom );
	if ( this.viz !== undefined )
	    this.viz.setYZoom( newZoom );
    }
    
});



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
	dot_ctx.fillStyle = "rgba(64,128,255,0.63)";
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
	self.setYZoom = setYZoom;

	fX.domain([fStart, fEnd]).nice();
	fY.domain([-1500,1500]).nice();

	var fAccurecy = 0;
	var fValueMin;
	var fValueMax;
	var fYZoom = 1.0;

	var zoom = d3.behavior.zoom();
	d3.select(fCanvas).call(zoom);
        zoom
	    .x(fX)
	    .on("zoom", doZoom)
	    .on("zoomend", zoomEnd)
	;

	return self;

	function setYZoom ( newValue ) {
	    fYZoom = newValue/100;
	    updateYDomain( fValueMin, fValueMax );
	}

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

	function updateYDomain ( min, max ) {
	    fValueMin = min;
	    fValueMax = max;
	    var useValue = fYZoom * Math.max(
		Math.abs(fValueMin),
		Math.abs(fValueMax)
	    );

	    fY.domain( [useValue * -1, useValue] );

	    schudleDraw();
	}

	function updateGraph ( data ) {
	    var buffer = loadBuffer( data );
	    addData( buffer );

	    if ( fDrawSchulded === false ) {
		requestAnimationFrame(function () {
		    var yDomain = plotPoints([buffer], fContext, fPoint, fX, fY, fAccurecy);
		    // We assume that either or both of min and
		    // max will be set.
		    if ( fValueMin === undefined
			 || fValueMin > yDomain[0] 
			 || fValueMax < yDomain[1] ) {
			updateYDomain( yDomain[0], yDomain[1] );
		    }
		});
	    }
	    
	}

	function schudleDraw ( ) {
	    if ( fDrawSchulded === false ) {
		fDrawSchulded = true;
		requestAnimationFrame( drawGraph );
	    }
	}

	function drawGraph ( ) {
	    fDrawSchulded = false;
	    
	    fContext.beginPath();
	    fContext.clearRect(0, 0, fWidth, fHeight);

	    var yDomain = plotPoints(fData, fContext, fPoint, fX, fY, fAccurecy);
	    /*
	    if ( fValueMin !== yDomain[0] || fValueMax !== yDomain[1] ) {
		updateYDomain(yDomain[0], yDomain[1]);
	    }
	    */
	}

	function addData ( buffer ) {
	    fData.push( buffer );
	    fData.sort( tileCmp );
	}

    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function plotPoints ( data, context, point, xScale, yScale, accuracy ) {
	var lastX   = undefined;
	var lastY   = undefined;

	var totalPoints = 0 | 0;
	var usedPoints  = 0 | 0;
	
	var domain = xScale.domain();
	var xMin = domain[0];
	var xMax = domain[1];
	var range = xScale.range();
	var xFactor = (xMax - xMin)/(range[1] - range[0]);
	var yRange =  yScale.range();
	var yDomain = yScale.domain();
	var yMin = yDomain[0];
	var yFactor = Math.abs((yDomain[1] - yMin)/(yRange[1] - yRange[0]));

	var minValue = undefined;
	var maxValue = undefined;

	for ( var i = 0 ; i < data.length ; i++ ) {

	    var buffer   = data[i];
	    var iterator = initIterator( buffer );

	    inner:
	    while ( nextValue( buffer, iterator ) !== 0 ) {
		totalPoints++;
		
		var value = readValue( iterator );
		var time  = readTime( iterator );

		if (  time > xMax )
		    break inner;

		if (  time <= xMin )
		    continue inner;
		
		if ( minValue === undefined || minValue > value )
		    minValue = value;

		if ( maxValue === undefined || maxValue < value )
		    maxValue = value;

		//var x = (time - xMin)/xFactor;
		//var y = (value - yMin)/yFactor;
		var x = xScale( time );
		var y = yScale( value );
		
		if ( accuracy > 0 ) {
		    // If we are aproxamating roud to pixials
		    x = ( x + 0.5 ) | 0;
		    y = ( y + 0.5 ) | 0;
		    
		    // We assume either niter or both of
		    // last x and y will be set.
		    if ( lastX !== undefined
			 && Math.abs(lastX - x) <= accuracy
			 && Math.abs(lastY - y) <= accuracy )
			continue inner;
		}
		

		usedPoints++;

		lastX = x;
		lastY = y;
		
		context.drawImage(point, x, y);
	    }

	    finishIterator( iterator );

	    
	    if ( time > xMax )
		break;
	}

	//console.log( "Used %d out of %d points for range %d to %d", usedPoints, totalPoints, xMin, xMax );
	return [minValue, maxValue];
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

    return viz;

    function getMyData ( startTime, endTime ) {
	if ( startTime != 0 ) //BUG: wont work for epoc tile
	    getData( source, type, startTime, endTime, handleData );
    }

    function handleData ( tile ) {
	viz.updateGraph( tile );
    }
}
