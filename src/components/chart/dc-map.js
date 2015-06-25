"use strict";

new function() {
var BUCKET_SIZE = 24 * 60 * 60 * 1000;
var requestedTimes = {};

// register a new element called proto-element
Polymer({
    is: "dc-map",
    properties: {
	source: {
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
    },
    // add a callback to the element's prototype
    ready: function() {
	var sources = this.source
	    .split(',')
	    .map(function (s) { return s.trim() })
	;
	this.viz = loadMap( this, sources, this.start, this.end );
    },    
});



function snapBound ( time, bucketSize ) {
    return Math.floor( time / bucketSize ) * bucketSize;
}

function makePath ( dataSource, tileTime ) {
    var result = '/data/' + dataSource + ':' + tileTime + '.tile';
    return result;
}

function getData ( source, start, end, handler ) {
    var tileStart  = snapBound( start, BUCKET_SIZE );
    var requestMax = snapBound( end, BUCKET_SIZE ) + BUCKET_SIZE ;

    getDataWorker( source, tileStart, handler );

    // Defer the spicltive work
    Promise.resolve(true).then( function () {
	getDataWorker( source, tileStart - BUCKET_SIZE, handler );
    
	for ( var i = tileStart ; i < requestMax ; i += BUCKET_SIZE ) {
	    getDataWorker( source, i, handler );
	}
    });
    
}



function getDataWorker ( source,  tileStart, handler ) {
    var dataPath = makePath( source, tileStart ) ;

    if ( requestedTimes[ dataPath ] != true ) {
	doFetch( source, dataPath, handler );	
    }
}


var Viz = new function ( ) {
    var COLORS = [
	"rgba(0,0,128,0.56)",
	"rgba(0,128,0,0.56)",
	"rgba(128,0,0,0.56)",
    ];

    return constructor;

    function constructor ( root, sources, title, units, start, end ) {
	var canves  = root.querySelector( "#chart" );
	var svg     = root.querySelector( "#map-svg" );
	var context = canves.getContext("2d");

	var width  = 950; //canves.getAttribute( "width" );
	var height = 500; //canves.getAttribute( "height" );

	console.log( "width %s, height %s", width, height, canves );

	var dots = {};
	var data = {};

	for ( var i = 0 ; i < sources.length ; i++ ) {
	    dots[ sources[i] ] = makePoint( getColor( i ) );
	    data[ sources[i] ] = [];
	    }

	var drawSchulded = false;

	var self = init( data, canves, svg, context, sources, dots, start, end, drawSchulded, width, height );

	return self;
    }

    function getColor ( index ) {
	return COLORS[  index % COLORS.length ];
    }

    function makePoint ( color ) {
	var dot_canvas = document.createElement('canvas');
	dot_canvas.width  = 6;
	dot_canvas.height = 6;

	var dot_ctx = dot_canvas.getContext("2d");
	dot_ctx.fillStyle = color;
	dot_ctx.moveTo(3,3);
	dot_ctx.arc(3, 3, 2.5, 0, 2 * Math.PI);
	dot_ctx.fill();

	return dot_canvas;
    }

    function init ( fData, fCanvas, fSvg, fContext, fSources, fPoints, fStart, fEnd, fDrawSchulded, fWidth, fHeight ) {

	var fAccurecy = 0;

	var projection = d3.geo.mercator()
	    .scale((1 << 12) / 2 / Math.PI)
	    .translate([fWidth / 2, fHeight / 2])
	;

	var center = projection([fWidth / 2, fHeight / 2]);

	var path = d3.geo.path()
	    .projection(projection)
	;

	var fX = d3.scale.linear()
	    .range([0, fWidth])
	    .domain([0, fWidth])
	;

	var fY = d3.scale.linear()
	    .range([fHeight, 0])
	    .domain([fHeight, 0])
	;
	
	var zoom = d3.behavior.zoom()
	    .x(fX)
	    .y(fY)
	    .on("zoom", doZoom)
	    .on("zoomend", zoomEnd )
	;

	zoom
	    .scale( 600 )
	    .translate([fWidth/2, fHeight/2])
	;

	projection
	    .scale(1 / 2 / Math.PI)
	    .translate([0, 0])
	;

	d3.select(fCanvas).call(zoom);

	/// start path stuff ////

	var svg = d3.select(fSvg)
	    .attr("width", fWidth)
	    .attr("height", fHeight)
	;


	var vector = svg.append("path");
	var worldJson;

	d3.json("/data/world-50m.json", function(error, world) {
	    if (error) throw error;
	    worldJson = world;

	    svg.call(zoom);
	    vector.attr("d", path(topojson.mesh(world, world.objects.countries)));
	    doZoom();
	});
	//// end path stuff ///

	var self = { };
	self.updateGraph = updateGraph;

	return self;

	function doZoom ( ) {
	    
	    vector // more path stuff
		.attr("transform", "translate(" + zoom.translate() + ")scale(" + zoom.scale() + ")")
		.style("stroke-width", 1 / zoom.scale())
	    ;

	    var domain = fX.domain();
	    var range  = fX.range();
	    var dD     = domain[1] - domain[0];
	    var dR     = range[1] - range[0];
	    fAccurecy = 50000 * dD/dR;


	    schudleDraw( );
	}



	function zoomEnd  ( ) {
	    fAccurecy = 0;

	    schudleDraw( );
	}


	function updateGraph ( source, data ) {
	    var buffer = loadBuffer( data );
	    var point  = addData( source, buffer );
	    if ( fDrawSchulded === false ) {
		requestAnimationFrame(function () {
		    plotPoints([buffer], fContext, point, projection, fAccurecy, fX, fY);
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
	 
	    console.log( "plotting...",  fSources ); //BOOG
	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var source = fSources[ i ];
		console.log( "ploting source %s", source ); //BOOG
		plotPoints(fData[ source ], fContext, fPoints[ source ], projection, fAccurecy, fX, fY);	
	    }
	    console.log( "...done" ); //BOOG
	}

	function addData ( source, buffer ) {
	    var point;
	    
	    if ( fData[ source ] === undefined ) {
		fData[ source ] = [ buffer ];
		fSources.push( source );
		fPoints[ source ] = makePoint( getColor( sources.length ) );
	    }
	    else {
		fData[source].push( buffer );
		fData[source].sort( tileCmp );
	    }


	    return fPoints[ source ];
	}

    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function plotPoints ( data, context, point, projection, accuracy, fX, fY ) {
	var lastX   = undefined;
	var lastY   = undefined;

	var xRange = fX.range();
	var yRange = fY.range();
	var minX   = xRange[0];
	var maxX   = xRange[1];
	var minY   = yRange[0];
	var maxY   = yRange[1];

	var totalPoints = 0 | 0;
	var usedPoints  = 0 | 0;
	
	for ( var i = 0 ; i < data.length ; i++ ) {

	    var buffer   = data[i];
	    var iterator = initIterator( buffer );

	    inner:
	    while ( nextValue( buffer, iterator ) !== 0 ) {
		totalPoints++;
		var lat = readValue( iterator );
		var lon = readVariance1( iterator );
		var xy = projection( [lon, lat] );
		var x = fX(xy[0]);
		var y = fY(xy[1]);
		
		if ( ( x < minX || x > maxX )
		     && ( y < minY || y > maxY ) )
		    continue;

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
	}

	console.log( "Used %d out of %d points", usedPoints, totalPoints );
    }

}



var doFetch = new function () {
    var queue       = [ ];
    var outstanding = 0;
    var MAX = 10;

    return doFetch;

    function doFetch ( source, file, handler ) {
	if ( outstanding >= MAX )
	    queue.push( [source, file, handler] );

	else
	    doFetchWorker( source, file, handler );
    }

    function done () {
	outstanding--;
	if ( outstanding < MAX && queue.length > 0 )  {
	    var next = queue.shift();
	    doFetchWorker( next[0], next[1], next[2] );
	}
    }

    function doFetchWorker ( source, file, handler ) {
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
	    handler( source, data );
	}
    }
}


function loadMap ( root, sources, startDate, endDate ) {

    var startTime = startDate.getTime();
    var endTime   = endDate.getTime();
    

    var viz = Viz( root, sources, "example map", startTime, endTime );

    for ( var i = 0 ; i < sources.length ; i++ ) {
	getMyData( sources[i], startTime, endTime );
    }

    return viz;

    function getMyData ( source, startTime, endTime ) {
	if ( startTime != 0 ) //BUG: wont work for epoc tile
	    getData( source, startTime, endTime, viz.updateGraph );
    }

}
}
