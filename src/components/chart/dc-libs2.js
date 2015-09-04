var BatchAction = new function ( ) {
    var LATER = Promise.resolve(true);
    return init;

    function init ( ) {
	
	var fBatchSchulded = false;
	var fSchudled      = {};
	var fWork          = [];

	var self = {};

	self.batch = batch;
	self.idle  = idle;

	return self;

	function idle ( idelTime, callback, args ) {
	    var name = callback.name;
	    if ( fSchudled[ name ] === undefined ) {
		fSchudled[ name ] = true;
		setTimeout( function () { 
		    callback( args ); 
		    fSchudled[ name ] = undefined;
		}, idelTime );
	    }
	}

	function batch ( callback, args ) {

	    if ( fSchudled[ callback.name ] === undefined ) {
		fSchudled[ callback.name ] = true;
		fWork.push( [ callback, args ] );
	    }

	    if ( fBatchSchulded === false ) {
		LATER.then( doBatches );
		fBatchSchulded = true;
	    }
	}

	function doBatches ( ) {
	    var work = fWork;

	    fBatchSchulded = false;
	    fWork          = [];

	    for ( var i = 0 ; i < work.length ; i++ ) {
		var job = work[i];
		job[0].call( job[0], job[1] );
		fSchudled[ job[0].name ] = undefined;
	    }
	}
    }
}; 

var DataFetcher = new function ( ) {
    var MAX = 10;
    return constructor;

    function constructor ( ) {

	var self = init( );

	return self;
    }


    function init ( ) {
	var fQueue       = [ ];
	var fOutstanding = 0;
	
	var self = {};

	self.fetch = doFetch;

	return self;

	function doFetch ( file, handler, error, handlerArg ) {
	    if ( fOutstanding >= MAX )
		fQueue.push( [file, handler, error, handlerArg] );

	    else
		doFetchWorker( file, handler, error, handlerArg );
	}

	function done () {
	    fOutstanding--;
	    if ( fOutstanding < MAX && fQueue.length > 0 )  {
		var next = fQueue.shift();
		doFetchWorker.apply( doFetchWorker, next );
	    }
	}

	function doFetchWorker ( file, handler, error, handlerArg ) {
	    fOutstanding++;
	    fetch(file)  
		.then( function(response) { 
		    if (response.status !== 200) {  
			error( response.status, handlerArg );
			done();
			return;  
		    }

		    response.arrayBuffer()
			.then(finish)
			.catch(function(err) {
			    done();	
			    error( err, handlerArg );
			});  
		} )  
		.catch(function(err) {
		    done();
		    error( err, handlerArg );
		});

	    function finish ( data ) {
		done();
		handler(data, handlerArg);
	    }
	}
    }

};


var RemoteData = new function ( ) {
    var BUCKET_SIZE = 24 * 60 * 60 * 1000;
    var sNextSourceId = 1;
    return factory;

    function factory ( fBufferInfo, fFetcher, fSource, fType, fStart, fEnd, projection, xRange, yRange, color ) {

	var fColor      = new Float32Array( color );
	var fRanges     = [];
	var fSelectons  = [];
	var fProjection = projection.slice(0);
	var fBatcher    = new BatchAction ( );


	for ( var i = 0 ; i < 2 ; i++ ) {
	    fRanges.push({min: undefined, max: undefined} );
	    fSelectons.push({min: undefined, max: undefined} );
	}

	fRanges[0].min = fStart;
	fRanges[0].max = fEnd;
	
	if ( xRange !== undefined ) {
	    fSelectons[0].min = xRange[0];
	    fSelectons[0].max = xRange[1];
	}

	else {
	    fSelectons[0].min = fStart;
	    fSelectons[0].max = fEnd;
	}
	
	if ( yRange !== undefined ) {
	    fSelectons[1].min = yRange[0];
	    fSelectons[1].max = yRange[1];
	}


	var fSourceId = sNextSourceId++;

	return init( 
	    fBufferInfo,
	    fFetcher, 
	    fSourceId, fSource, fType, 
	    fStart, fEnd,
	    fProjection,
	    fRanges, fSelectons, 
	    fColor );
    }

    function init ( 
	fBufferInfo,
	fFetcher, 
	fSourceId, fSource, fType, 
	fStart, fEnd,
	fProjection,
	fRanges, fSelectons, 
	fColor ) {

	var fBatcher         = new BatchAction ( );
	var self             = {};
	var fRequestedTimes  = {};
	var fListeners       = [];
	var fNewData         = [];
	var fEventsTriggeres = [];
	var fLastRun         = performance.now();
	var fRunTime         = 0;

	self.getId           = getId;
	self.getProjection   = getProjection;
	self.addListener     = addListener;
	self.getRange        = getRange;
	self.getStart        = getStart;
	self.getEnd          = getEnd;
	self.getMin          = getMin;
	self.getMax          = getMax;
	self.getColor        = getColor;

	getData( fFetcher, fSource, fType, fStart, fEnd, gotData, noData );

	return self;

	function getId ( ) {
	    return fSourceId;
	}

	function getProjection ( ) {
	    return fProjection.slice(0);
	}

	function addListener ( callback, options ) {
	    fListeners.push( [ callback, options ] );
	}

	function getRange ( start, end ) {
	    // BUG: something like this but we probbly should track the range.
	    //getData( fFetcher, fSource, fType, start, end, gotData, noData );
	}

	function getStart ( ) {
	    return fSelectons[0].min;
	}

	function getEnd ( ) {
	    return fSelectons[0].max;
	}

	function getMin ( ) {
	    return fSelectons[1].min;
	}

	function getMax ( ) {
	    return fSelectons[1].max;
	}
	
	function getColor ( ) {
	    return fColor;
	}

	function triggerEvents (  ) {
	    var idelTime = fRunTime;
	    fBatcher.idle( idelTime, triggerEventsWorker );
	}


	// BUG: Sould move to Viz
	function bindBuffer ( bufferInfo ) {
	    var gl = bufferInfo.context;
	    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.glPointer);
	    gl.bufferData(gl.ARRAY_BUFFER, bufferInfo.data, gl.STATIC_DRAW);
	}

	function triggerEventsWorker ( ) {
	    var startTime = performance.now()
	    var newData = handleNewData( fNewData );

	    bindBuffer( fBufferInfo );

	    for ( var i = 0 ; i < fListeners.length ; i++ ) {
		var callbackInfo = fListeners[i]; 
		callbackInfo[0]( self, fBufferInfo, newData.slice(0), callbackInfo[1] );
	    }

	    fNewData.length = 0;
	    
	    fLastRun = performance.now();
	    fRunTime = fLastRun - startTime;
	}

	function handleNewData ( tileArrays ) {

	    var start        = self.getStart();
	    var end          = self.getEnd();

	    var newDataInfo = [];

	    for ( var i = 0 ; i < tileArrays.length ; i++ ) {
		var tileArray    = tileArrays[ i ];
		var tilePointer  = loadBuffer( tileArray );

		var dataInfo =
		    loadGlBuffer( identityFunction, tilePointer, 
				  fBufferInfo, start, end, fProjection );

		newDataInfo.push( dataInfo );

		freeBuffer( tilePointer );
	    }
	    
	    return newDataInfo;
	}

	function gotData ( dataArray, tileStart ) {
	    fNewData.push( dataArray );
	    triggerEvents();
	}

	function noData ( error, tileStart ) {
	    // Errors are allready reported in the newtwork tab
	    // so we don't bother.
	    fRequestedTimes[ tileStart ] = false ;
	}

	function getData ( fetcher, source, type, start, end, handler, error ) {
	    var tileStart  = snapBound( start, BUCKET_SIZE );
	    var requestMax = snapBound( end, BUCKET_SIZE ) + BUCKET_SIZE ;

	    getDataWorker( fetcher, source, type, tileStart, handler, error );

	    // Defer the spicltive work
	    Promise.resolve(true).then( function () {
		getDataWorker( fetcher, source, type, tileStart - BUCKET_SIZE, handler, error );
		
		for ( var i = tileStart ; i < requestMax ; i += BUCKET_SIZE ) {
		    getDataWorker( fetcher, source, type, i, handler, error );
		}
	    });
	    
	}

	function getDataWorker ( fetcher, source, type, tileStart, handler, error ) {
	    var dataPath = makePath( source, type, tileStart ) ;
	    
	    if ( fRequestedTimes[ tileStart ] != true ) {
		fRequestedTimes[ tileStart ] = true ;
		fetcher.fetch( dataPath, handler, error, tileStart );	
	    }
	}

    }    


    function makePath ( dataSource, type, tileTime ) {
	var result = '/data/' + dataSource + ':' + type + ':' + tileTime + '.tile';
	return result;
    }

    function initSorceData ( xStart, xEnd, projection, names ) {
	return {
	    xStart        : xStart,
	    xEnd          : xEnd,
	    projection    : projection,
	    names         : names,
	    minX          : undefined,
	    maxX          : undefined,
	    minY          : undefined,
	    maxY          : undefined, 
	    pointsCount   : 0, 
	    dataOffset    : 0,
	};
    }

    function loadGlBuffer ( loadFunction, tilePointer, bufferInfo, start, end, projection ) {
	
	var iterator = initIterator( tilePointer );

	var buffer = bufferInfo.data;
	var offset = bufferInfo.offset;

	var names = getNames( iterator );

	var indexes = [];

	for ( var i = 0 ; i < projection.length ; i++ ) {
	    var index = names[projection[i]];

	    // BUG: there must be a better thing to do hear
	    if ( index === undefined )
		index = 0;

	    indexes.push( index );
	}
	
	var dataInfo = initSorceData( start, end, projection, names );


	while ( hasMore( iterator ) ) {
	    offset = loadFunction( tilePointer, iterator, dataInfo, indexes, buffer, offset);
	    if ( hasMore( iterator ) ) {
		var newBuffer = new Float32Array( buffer.length * 2 );
		newBuffer.set( buffer );
		buffer = newBuffer;
	    }
	}

	finishIterator( iterator );

	bufferInfo.offset = offset;
	bufferInfo.data   = buffer;

	return dataInfo;
    }

};

function snapBound ( time, bucketSize ) {
    return Math.floor( time / bucketSize ) * bucketSize;
}

function identityFunction ( tilePointer, iterator, dataInfo, indexes, buffer, offset ) {

    var minIndex = dataInfo.xStart;

    dataInfo.dataOffset  = offset;
    dataInfo.pointsCount = readEntriesCount( iterator );

    // BUG: we should generlize this
    dataInfo.minX = readColumnMin( iterator, indexes[0] );
    dataInfo.maxX = readColumnMax( iterator, indexes[0] );
    dataInfo.minY = readColumnMin( iterator, indexes[1] );
    dataInfo.maxY = readColumnMax( iterator, indexes[1] );

    var columns = indexes.length;

    for ( var j = offset ; 
	  buffer.length > (j + columns - 1) 
	  && nextValue( tilePointer, iterator ) !== 0 ; 
	  j += columns ) {
	for ( var i = 0 ; i < indexes.length ; i++ ) {

	    if ( i === 0 )
		// BUG: we should remove this special case
		buffer[j] = readValue( iterator, indexes[0] ) - minIndex;
	    else
		buffer[j+i] = readValue( iterator, indexes[i] );
	}
    }


    return j;
}


var BasePlot = new function ( ) {
    var sId = 0;
    return factory;

    function factory ( fRoot, options ) {

	var fGroup = 0;

	if ( options.group !== undefined )
	    fGroup = options.group;

	return init( fRoot );
    }

    function init ( fRoot, fGroup ) {
	var self = {};

	var fId = sId++;

	self.id           = id;
	self.doDraw       = undefined;
	self.addData      = undefined;
	self.getGroup     = getGroup;
	self.resize       = resize;

	return self;

	function id ( ) {
	    return fId;
	}

	function getGroup ( ) {
	    return fGroup;
	}

	function resize ( ) {

	}
    }
};


var ScatterPlot = new function ( ) {
    return factory;

    function factory ( fViz, fRoot, fGl, fSelectons, options ) {

	var fLockZoom = false;

	if ( options.lockZoomXY === true )
	    fLockZoom = true;

	var self = BasePlot( fRoot, options );

	return init( self, fViz, fRoot, fGl, fSelectons, fLockZoom );
    }

    function init ( self, fViz, fRoot, fGl, fSelectons,  fLockZoom ) {

	var fSources     = [];
	var fSourceBuffers = [];
	var fListeners   = [];
	var fMinX        = fSelectons.getMin( 'lon' );
	var fMaxX        = fSelectons.getMax( 'lon' );
	var fMinY        = fSelectons.getMin( 'lat' );
	var fMaxY        = fSelectons.getMax( 'lat' );
	var fGlVars      = initShaders( fRoot, fGl );
	var fZoom        = d3.behavior.zoom();
	var fX           = d3.scale.linear();
	var fY           = d3.scale.linear();

	fX.domain([fMinX, fMaxX]);
	fY.domain([fMinY, fMaxY]);

        fZoom
	    .x(fX)
	    .y(fY)
	    .on("zoom", updateSelections)
	;

	d3.select(fRoot).call(fZoom);

	self.doDraw   = doDraw;
	self.addData  = addData;
	self.resize   = resize;

	return self;

	function updateKey ( key, results, minVal, maxVal ) {

	    var range = results[ key ];
	    
	    if ( range === undefined ) {
		range = { min : undefined, max : undefined };
		results[ key ] = range;
	    }
	    
	    if ( minVal !== undefined && 
		 (range.min === undefined || range.min > minVal ) )
		range.min = minVal;

	    if ( maxVal !== undefined && 
		 (range.max === undefined || range.max > maxVal ) )
		range.max = maxVal;
	}


	// BUG: Should this check which axies we are changing?
	function updateSelections ( ) {
	    var results = {};

	    var xDomain = fX.domain();
	    var yDomain = fY.domain();

	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var sourceConfig = fSources[i];
		var projection   = sourceConfig.projection;

		updateKey( projection[1], results, xDomain[0], xDomain[1] );
		updateKey( projection[2], results, yDomain[0], yDomain[1] );
	    }


	    var keys = Object.keys( results );

	    
	    for ( var i = 0 ; i < keys.length ; i++ ) {
		var key   = keys[i];
		var range = results[key];
		
		fSelectons.setSelection( key, range.min, range.max );
	    }

	}

	function addData ( sourceObject ) {

	    var sourceConfig = {};

	    sourceConfig.bufferInfo   = undefined;
	    sourceConfig.sourceObject = sourceObject;
	    sourceConfig.projection   = sourceObject.getProjection();

	    fSources.push( sourceConfig );
	    fSourceBuffers[ sourceObject.getId() ] = [];

	    sourceObject.addListener( handleNewData, sourceConfig );
	}


	function doDraw ( ) {
	    var elementBox = fRoot.getBoundingClientRect();
	    var top        = fRoot.offsetTop;
	    var left       = fRoot.offsetLeft;
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var sourceConfig = fSources[i];
		var bufferInfo   = sourceConfig.bufferInfo;

		if ( bufferInfo === undefined )
		    continue;

		var source       = sourceConfig.sourceObject;
		var color        = source.getColor();
		var sourceKey    = source.getId();
		var data         = fSourceBuffers[ sourceKey ];
		var fieldsCount  = sourceConfig.projection.length;

		var indexMin = fSelectons.getMin( 'lon' );
		var indexMax = fSelectons.getMax( 'lon' );
		var valueMin = fSelectons.getMin( 'lat' );
		var valueMax = fSelectons.getMax( 'lat' );
		var timeMin  = fSelectons.getMin( 'time' );
		var timeMax  = fSelectons.getMax( 'time' );
		var hwid     = fSelectons.getMin( 'hwid' );

		if ( valueMin === undefined )
		    valueMin = fMinY;

		if ( valueMax === undefined )
		    valueMax = fMaxY;


		fGl.bindBuffer(fGl.ARRAY_BUFFER, bufferInfo.glPointer);
		
		doGlDraw( fGl, fGlVars, fieldsCount,
			  indexMin, indexMax, valueMin, valueMax,
			  timeMin, timeMax, hwid,
			  top, left, width, height, data, color );
	    }

	}


	function handleNewData ( source, bufferInfo, newData, sourceConfig ) {

	    var sourceKey = source.getId();

	    // BUG: only really has to happen the first time
	    sourceConfig.bufferInfo = bufferInfo;

	    for ( var i = 0 ; i < newData.length ; i++ ) {
		
		var dataInfo = newData[i];

		fSourceBuffers[ sourceKey ].push( dataInfo );

		if ( fMinY === undefined || fMinY > dataInfo.minY )
		    fMinY = dataInfo.minY;

		if ( fMaxY === undefined || fMaxY < dataInfo.maxY )
		    fMaxY = dataInfo.maxY;
	    }
	    

	    fViz.schudleDraw();
	}


	function resize ( ) {
    	    var elementBox = fRoot.getBoundingClientRect();
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    
	    fX.range( [0, width] );
	    fY.range( [height, 0] );

	    fZoom.x(fX);
	    fZoom.y(fY);
	}
    }



};


var BarChart = new function ( ) {
    var DAY = 24*60*60;
    return factory;

    function factory ( fViz, fRoot, fGl, fSelectons, options ) {
	var fX      = d3.time.scale.utc();
	var fY      = d3.scale.linear();
	var fColumn = options.column;
	var fGroupBy = [];

	if ( options.groupBy !== undefined )
	    fGroupBy = options.groupBy.slice(0);

	var self = BasePlot( fRoot, options );

	return init( self, fViz, fRoot, fGl, fSelectons, fColumn, fGroupBy, fX, fY );
    }

    function init ( self, fViz, fRoot, fGl, fSelectons, fColumn, fGroupBy, fX, fY ) {

	var fSources       = [];
	var fListeners     = [];
	var fD3Data        = {};
	var fSourceBuffers = {};
	var fMinY          = undefined;
	var fMaxY          = undefined;
	var fMinX          = fSelectons.getMin( 'time' );
	var fMaxX          = fSelectons.getMax( 'time' );
	var fMinSelection  = fSelectons.getMin( 'time' );
	var fMaxSelection  = fSelectons.getMax( 'time' );

	var fGroup         = undefined;
	var fZoom          = d3.behavior.zoom();
	var fBatcher       = new BatchAction ( );
	var fGroupCount    = 1;

	var fChart       = undefined;
	var fXAxis       = undefined;
	var fYAxis       = undefined;
	var fDataBuffer  = new Float32Array( 1000 * 2 );
	var fDays        = 0;

	var fMargin = {top: 30, right: 60, bottom: 80, left: 60};
	var fWidth;
	var fHeight;
	var fZoomBox;
	var fChartBars;
	var fClip;

	initChart( );

	fSelectons.addListener( selectionChanged );

	self.doDraw  = doDraw;
	self.addData = addData;
	self.resize  = resize;
	
	return self;

	function selectionChanged ( keys ) {
	    // BUG: assumes only we change time
	    if ( keys.length > 1 || keys[0] != "time" ) 
		fBatcher.batch( selectionChangedWorker, [keys] );
	}
	

	function selectionChangedWorker ( keys ) {
	    fMinY = undefined;
	    fMaxY = undefined;


	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var source = fSources[i];
		
		recomputeData( fSources[i], 0 );
	    }	 

	    var newMin = fSelectons.getMin( 'time' );
	    var newMax = fSelectons.getMax( 'time' );

	    if ( fMinSelection !== newMin || fMaxSelection !== newMax ) {
		fMinSelection = newMin;
		fMaxSelection = newMax;

		fX.domain( [fMinSelection, fMaxSelection] );
		fZoom.x(fX);
	    }


	    fY.domain([0, fMaxY]);
	    fViz.schudleDraw();
	}


	function resize ( ) {

	    var elementBox = fRoot.getBoundingClientRect();

	    fWidth  = elementBox.width - fMargin.left - fMargin.right;
	    fHeight = elementBox.height - fMargin.top - fMargin.bottom;
	    
	    fWidth  = Math.max( fWidth, 0 );
	    fHeight = Math.max( fHeight, 0 );

	    fX.range([0, fWidth]);
	    fY.range([fHeight, 0]);

	    fZoom.x(fX);

	    fChart
	    	.attr("transform", "translate(" + fMargin.left + "," + fMargin.top + ")")
	    ;

	    fZoomBox
		.attr("width", fWidth ) 
		.attr("height", fHeight )
	    ;

	    fClip
		.attr("width", fWidth ) 
		.attr("height", fHeight )
	    ;

	    fChart.select(".x-axis")
		.attr("transform", "translate(0," + fHeight + ")")
		.call(fXAxis)
	    ;

	    fChart.select(".y-axis")
		.call(fYAxis)
	    ;
	}

	function initChart ( ) {
	    
	    fGroup = d3.scale.ordinal();

	    fXAxis = d3.svg.axis()
		.scale(fX)
		.orient("bottom");

	    fYAxis = d3.svg.axis()
		.scale(fY)
		.orient("left")
		.tickFormat(d3.format(".2s"));


	    fChart = d3.select(fRoot).select("#bar-chart")
		.append("g")
		.classed("content", true)
	    ;


	    fChart.append("g")
		.attr("class", "x-axis")
		.call(fXAxis)
	    ;

	    fChart.append("g")
		.attr("class", "y-axis")
		.call(fYAxis)
		.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 6)
		.attr("dy", ".71em")
		.style("text-anchor", "end")
		.text("Count Per-day")
	    ;

	    fClip = fChart.append("clipPath")
		.attr("id", "clip")
		.append("rect")
	    ;

	    fChartBars = fChart.append("g")
		.classed("bars-container", true )
		.attr("clip-path", "url(#clip)")
	    ;


	    fZoomBox = fChart
		.append("rect")
		.classed("zoomBox", true)
		.style("fill", "rgba(0,0,0,0)" )
	    	.style("stroke-width", 0)
	    ;    

	    fX.domain( [fMinSelection, fMaxSelection] );

	    fZoom
		.x(fX)
		.on("zoom", doZoom)
	    ;

	    fZoomBox.call(fZoom);

	}


	function doZoom ( ) {
	    var timeDomain = fX.domain( );

	    fMinSelection = timeDomain[0].getTime();
	    fMaxSelection = timeDomain[1].getTime();

	    fSelectons.setSelection( 'time',
				     fMinSelection, 
				     fMaxSelection );

	}

	function addData ( sourceObject ) {

	    var sourceConfig = {};

	    sourceConfig.bufferInfo   = undefined;
	    sourceConfig.sourceObject = sourceObject;
	    sourceConfig.projection   = sourceObject.getProjection();
	    fSources.push( sourceConfig );

	    sourceObject.addListener( handleNewData, sourceConfig );

	    fSourceBuffers[ sourceObject.getId() ] = [];
	}


	function formatColor ( parts ) {
	    return "rgb(" 
		+ (parts[0] * 255) +","
		+ (parts[1] * 255) +","
		+ (parts[2] * 255) +")";
	}

	function doDraw ( ) {

	    var sourceData  = [];
	    var sourceNames = [];
	    var dataKeys    = Object.keys( fD3Data );
	    var colors      = [ [1.0, 0.0, 0.0], [0.0, 1.0, 0.0] ];

	    var xDomain     = fX.domain();
	    var domainDelta = xDomain[1].getTime() - xDomain[0].getTime();
	    var days        = domainDelta/1000/DAY;
	    var bandWidth   = fWidth/days;

	    fGroup.rangeRoundBands([0, bandWidth], 0.1, 0.2);


	    for ( var i = 0 ; i < dataKeys.length ; i++ ) {
		/*
		var source       = fSources[i].sourceObject;
		var color        = source.getColor();
		var sourceKey    = source.getId();
		*/
		var key      = dataKeys[i];
		var plotData = fD3Data[ key ];
		var color    = colors[i];

		if ( plotData !== undefined ) {
		    sourceData.push( [ i, key, plotData, color ] );
		    sourceNames.push( i );
		}
	    }

	    fGroup.domain( sourceNames );

	    fChart.select(".x-axis")
		.call(fXAxis)
		.selectAll("text")
		.attr("y", 0)
		.attr("x", 35)
		.attr("dy", ".35em")
		.attr("transform", "rotate(90)")
	    ;

	    fX.ticks( d3.time.day );

	    fChart.select(".y-axis")
		.call(fYAxis)
	    ;

	    var sources = fChartBars.selectAll( ".bar-chart-data" )
		.data( sourceData, function ( d ) { return d[0] } )
	    ;

	    sources.enter()
		.append( 'g' )
	        .classed( 'bar-chart-data', true )
		.attr( 'transform', function (d, i) {
		    return "translate( " + fGroup(d[0]) + ", 0)";
		})
	    	.style("fill", function(d) { return formatColor(d[3]); })

	    ;

	    sources
		.attr( 'transform', function (d, i) {
		    return "translate( " + fGroup(d[0]) + ", 0)";
		})
	    	.style("fill", function(d) { return formatColor(d[3]); })
	    	.style("stroke-width", 0)
	    ;

	    sources.exit()
		.remove()
	    ;

	    var bars = sources.selectAll( 'rect' )
		.data( function ( d ) { return d[2]; } )
	    ;
	    
	    bars.enter()
		.append( 'rect' )
		.attr( 'x', function (d) { return fX( d[0] ) } )
		.attr( 'y', function (d) { return fY( d[1] ) } )
	    	.attr( 'width', Math.max( 1, fGroup.rangeBand() ) )
		.attr( 'height', function (d) { return fHeight - fY( d[1] ) } )
	    ;

	    bars
		.attr( 'x', function (d) { return fX( d[0] ) } )
		.attr( 'y', function (d) { return fY( d[1] ) } )
	    	.attr( 'width', Math.max( 1, fGroup.rangeBand() ) )
		.attr( 'height', function (d) {  return fHeight - fY( d[1] ) } )

	    ;

	    bars.exit()
		.remove()
	    ;
	}

	
	function recomputeData ( sourceConfig, offset ) {
	    var projection   = sourceConfig.projection;
	    var bufferInfo   = sourceConfig.bufferInfo;
	    var source       = sourceConfig.sourceObject;
	    var sourceKey    = source.getId();


	    if ( bufferInfo === undefined )
		return;

	    var data       = bufferInfo.data;
	    var stop       = (bufferInfo.offset/projection.length) | 0;
	    
	    var minLat = fSelectons.getMin( "lat" );
	    var maxLat = fSelectons.getMax( "lat" );

	    var minLon = fSelectons.getMin( "lon" );
	    var maxLon = fSelectons.getMax( "lon" );

	    var minTime = fMinX;
	    var maxTime = fMaxX;

	    var minHwid = fSelectons.getMin( "hwid" ) | 0;
	    var maxHwid = fSelectons.getMax( "hwid" ) | 0;

	    var days = Math.ceil( (maxTime - minTime)/(DAY * 1000) ) | 0;

	    fDays = days;

	    var firstDay = snapBound( minTime/1000, DAY );

	    var groups = [0,2]; 

	    fGroupCount = 2; // BUG: this sould be genrelized

	    var entryLength = 2 * fGroupCount | 0;

	    if ( fDataBuffer.length * entryLength < days ) {
		// Expand to be twice the required number of days
		var newLength = days * entryLength * 2;
		console.log( "extending data buffer to %s", newLength );
		fDataBuffer = new Float32Array( newLength );
		offset = 0;
	    }


	    for ( var i = offset | 0; i < days * entryLength ; i++ )
		  fDataBuffer[i] = 0;

	    var columns = projection.length;

	    // BUG: we shold try and start iteration at offset
	    // but that would require that requires lots of
	    // changes.
	    for ( var i = 0 | 0; i < stop ; i++ ) {
		var index = i*columns | 0;

		if ( index < offset )
		    continue;

		var lon  = data[index+1];
		var lat  = data[index+2];
		var hwid = data[index+3] | 0;
		

		if ( ( maxHwid !== 0 && minHwid !== 0 ) 
		     && ( minHwid > hwid || maxHwid < hwid )  )
		    continue;

		if ( minLon > lon || maxLon < lon )
		    continue;

		if ( minLat > lat || maxLat < lat ) 
		    continue;
		
		var day  = snapBound( data[index], DAY );
		
		if ( day < firstDay )
		    continue;

		var good = data[index+4] | 0;

		var groupOffset = good * 2 ;
		
		var dataIndex = (groupOffset + entryLength * (day - firstDay)/(DAY)) | 0;

		fDataBuffer[dataIndex] = day;
		fDataBuffer[dataIndex+1]++;
	    }

	    updateD3Data( sourceKey, entryLength );
	}


	function updateD3Data ( sourceKey, entryLength ) {
	    for ( var g = 0 ; g < fGroupCount ; g++ ) {
		var resultData = [];
		 // BUG: this is wrong but should work for now
		var groupOffset = g*2;

		for ( var i = 0 ; i < fDays ; i++ ) {
		    var index = i*entryLength + groupOffset;
		    var time  = fDataBuffer[index] * 1000;
		    var value = fDataBuffer[index+1];
		    
		    if ( fMinY === undefined || value )
			fMinY = value;

		    if ( fMaxY === undefined || fMaxY < value )
			fMaxY = value;

		    resultData.push( [time, value] );
		}
		fD3Data[sourceKey + ":" + g ] = resultData;
	    }
	}


	function handleNewData ( source, bufferInfo, newData, sourceConfig ) {


	    var sourceKey = source.getId();

	    // BUG: only really has to happen the first time
	    sourceConfig.bufferInfo = bufferInfo;

	    for ( var i = 0 ; i < newData.length ; i++ ) {
		fSourceBuffers[ sourceKey ].push( newData[i] );
	    }
	    

	    // BUG: this is kinda sketchy just using newData[0].dataOffset
	    recomputeData( sourceConfig, newData[0].dataOffset );

	    fY.domain([0, fMaxY]);
	    fViz.schudleDraw();
	}
    }

};

var ItemList = new function ( ) {
    return factory;

    function factory ( fViz, fRoot, fGl, fSelectons, options ) {
	var fColumn = options.column;

	var self = BasePlot( fRoot, options );

	return init( self, fViz, fRoot, fGl, fSelectons, fColumn );
    }

    function init ( self, fViz, fRoot, fGl, fSelectons, fColumn ) {

	var fSources       = [];
	var fListeners     = [];
	var fD3Data        = {};
	var fSourceBuffers = {};
	var fListData      = [];
	var fItemListNode  = d3.select( fRoot ).select(".item-list");
	var fCurrentSat    = 0;

	var fBatcher = new BatchAction ( );

	var fChart       = undefined;
	var fDataBuffer  = new Float32Array( 65536 );

	fSelectons.addListener( selectionChanged );

	self.doDraw  = doDraw;
	self.addData = addData;

	return self;

	function selectionChanged ( keys ) {
	    if ( keys.length > 1 || keys[0] !== 'hwid' )
		fBatcher.idle( 100, selectionChangedWorker );
	}
	

	function selectionChangedWorker () {
	    
	    for ( var i = 0 ; i < fDataBuffer.length ; i++ )
		fDataBuffer[i] = 0;

	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var source = fSources[i];
		
		recomputeData( fSources[i], 0 );
	    }

	    fViz.schudleDraw();
	}


	function addData ( sourceObject ) {
	    
	    var sourceConfig = {};

	    sourceConfig.bufferInfo   = undefined;
	    sourceConfig.sourceObject = sourceObject;
	    sourceConfig.projection   = sourceObject.getProjection();

	    fSources.push( sourceConfig );

	    sourceObject.addListener( handleNewData, sourceConfig );

	    fSourceBuffers[ sourceObject.getId() ] = [];
	}


	function setItemText ( d ) {
	    var node = this;
	    node.innerText = ("0000" + d.toString(16)).substr(-4);
	    
	    node.addEventListener('click', function ( event ) {
		event.stopPropagation();

		var selected = node.classList.contains('selected'); 

		if ( selected === true ) {
		    node.classList.remove('selected');
		    fSelectons.setSelection( 'hwid', 0, 0 );
		    fCurrentSat = 0;
		}

		else {
		    var current = fItemListNode.node().querySelector( ".selected" );
		    
		    if ( current !== null )
			current.classList.remove('selected');

		    node.classList.add('selected');

		    fSelectons.setSelection( 'hwid', d, d );
		    fCurrentSat = d;
		}

		fViz.schudleDraw();
	    } );

	    node.addEventListener('mouseenter', function ( event ) {
		event.stopPropagation();
		fSelectons.setSelection( 'hwid', d, d );
	    });

	    node.addEventListener('mouseleave', function ( event ) {
		event.stopPropagation();
		fSelectons.setSelection( 'hwid', fCurrentSat, fCurrentSat );
	    });

	}

	function doDraw ( ) {
	    
	    var bars = fItemListNode.selectAll( '.item' )
		.data( fListData, function (d) { return d } )
	    ;
	    
	    bars.sort( d3.ascending );

	    bars.enter()
		.append( 'li' )
		.classed( 'item', true)
		.each( setItemText )
	    ;

	    bars.exit()
		.remove()
	    ;
	}

	
	function recomputeData ( sourceConfig, offset ) {
	    var projection   = sourceConfig.projection;
	    var bufferInfo   = sourceConfig.bufferInfo;

	    if ( bufferInfo === undefined )
		return;

	    var data       = bufferInfo.data;
	    var stop       = bufferInfo.offset/projection.length;
	    
	    var minLat = fSelectons.getMin( "lat" );
	    var maxLat = fSelectons.getMax( "lat" );

	    var minLon = fSelectons.getMin( "lon" );
	    var maxLon = fSelectons.getMax( "lon" );

	    var minTime = fSelectons.getMin( "time" );
	    var maxTime = fSelectons.getMax( "time" );

	    for ( var i = 0 ; i < stop ; i++ ) {
		var index = i*projection.length;

		if ( index < offset )
		    continue;

		var time  = data[index] * 1000;
		var lon   = data[index+1];
		var lat   = data[index+2];
		var hwid  = data[index+3] | 0;
		//var good  = data[index+4];
		
		if ( minLon > lon || maxLon < lon )
		    continue;

		if ( minLat > lat || maxLat < lat ) 
		    continue;
		
		if ( minTime > time || maxTime < time )
		    continue;

		fDataBuffer[ hwid ] += 1;
	    }

	    fListData.length = 0;

	    for ( var i = 0 ; i < fDataBuffer.length ; i++ ) {
		if ( fDataBuffer[i] > 0 )
		    fListData.push( i );
	    }

	    fListData.sort( d3.ascending );
	}


	function handleNewData ( source, bufferInfo, newData, sourceConfig ) {

	    var sourceKey = source.getId();

	    // BUG: only really has to happen the first time
	    sourceConfig.bufferInfo = bufferInfo;

	    for ( var i = 0 ; i < newData.length ; i++ ) {
		fSourceBuffers[ sourceKey ].push( newData[i] );
	    }

	    recomputeData( sourceConfig, newData[0].dataOffset );

	    fViz.schudleDraw();

	}
    }

};

var Map = new function ( ) {
    return factory;


    function factory ( fRoot, fGl, fSelectons, options ) {
	var self = BasePlot( fRoot, options );
	return constructor( self, fRoot, fGl, fSelectons );
    }

    function constructor ( self, fRoot, fGl, fSelectons ) {
	var fSvg    = fRoot.querySelector( "#map-plot" );
	var fWidth  = 640;
	var fHeight = 480;
	var vector; // BUG: rename

	initMap( );

	self.doDraw = doDraw;

	return self;


	function doDraw () {
	    var scale = fZoom.scale();
	    var translate = fZoom.translate();

	    d3.select(".land")
		.attr("transform", "translate(" + translate + ")scale(" + scale[0] + ")")
		.style("stroke-width", 1 / scale[0])
	    ;
	    
	    

	}

	function initMap ( ) {

	    var projection = d3.geo.mercator()
		.scale((fWidth + 1) / 2 / Math.PI)
		.translate([fWidth / 2, fHeight / 2])
		.precision(.1)
	    ;

	    var path = d3.geo.path()
		.projection(projection)
	    ;

	    var graticule = d3.geo.graticule()
	    ;

	    var svg = d3.select(fSvg)
		.attr("width", fWidth)
		.attr("height", fHeight)
	    ;

	    d3.json("/data/world-50m.json", function(error, world) {
		if (error) throw error;

		svg.insert("path", ".graticule")
		    .datum(topojson.feature(world, world.objects.land))
		    .attr("class", "land")
		    .attr("d", path);

	    });

	}


    }

};

var Selections = new function ( ) {
    return constructor;

    function constructor ( ) {
	var self = {};
	
	var fBatcher     = new BatchAction ( );
	var fListeners   = [];
	var fSelections  = {};
	var fChangedKeys = [];

	self.addListener  = addListener;
	self.setSelection = setSelection;
	self.getMin       = getMin;
	self.getMax       = getMax;

	return self;

	function addListener ( callback, callbackArgs ) {
	    fListeners.push( [callback, callbackArgs]);
	}

	function setSelection ( key, minVal, maxVal ) {
	    fSelections[ key ] = [ minVal, maxVal ];
	    fChangedKeys[ key ] = true;
	    fBatcher.batch( notifyChanges );
	}


	function getMin ( key ) {
	    return getMinOrMax( key, 0 );
	}


	function getMax ( key ) {
	    return getMinOrMax( key, 1 );
	}


	function getMinOrMax ( key, index ) {
	    var result = undefined;
	    var value = fSelections[ key ];

	    if ( value !== undefined )
		result = value[index];

	    return result;
	}


	function notifyChanges ( ) {
	    var keys = Object.keys( fChangedKeys );
	    fChangedKeys = {};

	    for ( var i = 0 ; i < fListeners.length ; i++ ) {
		var callbackInfo = fListeners[i];
		callbackInfo[0]( keys.slice(0), callbackInfo[1] );
	    }
	}
    }
};


var Viz = new function ( ) {
    return constructor;

    function constructor ( root, fetcher ) {
	var canvas  = root.querySelector( "#chart" );
	var gl      = canvas.getContext("webgl");

	var width  = canvas.clientWidth;
	var height = canvas.clientHeight;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        //gl.enable(gl.DEPTH_TEST);           // Enable depth testing
	gl.disable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

	// BUG: do I really want this?
	gl.enable(gl.BLEND);
	//gl.disable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

	var self = init( root, fetcher, canvas, gl, width, height );

	return self;
    }

    function init ( fRoot, fFetcher, fCanvas, fGl, fWidth, fHeight ) {
	var self = { };

	self.resize       = resize;
	self.ready        = ready;
	self.addView      = addView;
	self.addData      = addData;
	self.setSelection = setSelection;
	self.schudleDraw  = schudleDraw;

	var fSourceKeys    = [];
	var fDataSources   = {};
	var fDrawSchulded  = false;
	var fViews         = [];
	var fZoomGroups    = {};
	var fSelections    = new Selections ();
	var fReady         = false;

	fSelections.addListener( schudleDraw );

	return self;

	function resize () {
	    for ( var i = 0 ; i < fViews.length ; i++ ) {
		fViews[i].resize( );
	    }

	    schudleDraw();
	}

	function ready () {
	    resize();
	    fReady = true;
	}

	function setSelection ( key, minValue, maxValue ) {
	    fSelections.setSelection( key, minValue, maxValue );
	}

	function addView ( Type, selector, sources, options ) {

	    var plotRoot = fRoot.querySelector( selector );

	    if ( plotRoot === undefined ) {
		console.log( "could not find element '%s'", selector );
		return;
	    }

	    var plot = Type( self, plotRoot, fGl, fSelections, options );
	    fViews.push( plot );

	    for ( var i = 0 ; i < sources.length ; i++ ) {
		var sourceKey    = sources[i];
		var sourceObject = fDataSources[ sourceKey ];

		plot.addData( sourceObject );
	    }

	    if ( fReady === true ) {
		prot.resize();
		schudleDraw();
	    }

	}

	function addData ( sourceName, typeName, start, end, projection, options ) {
	    var xRange;
	    var yRange;
	    var color = [0.0, 1.0, 0.0];

	    if ( options !== undefined ) {
		xRange = options.xRange;
		yRange = options.yRange;
		
		if ( options.color != undefined ) {
		    color = options.color;
		}
	    }

	    var bufferInfo  = { 
		offset    : 0, 
		data      : new Float32Array(1024 * 1024), 
		glPointer : fGl.createBuffer(),
		context   : fGl,
	    };

	    var source = new RemoteData ( bufferInfo, fFetcher, sourceName, typeName, start, end, projection, xRange, yRange, color );

	    var sourceKey = source.getId();
	    fDataSources[ sourceKey ] = source;
	    fSourceKeys.push( sourceKey );

	   return sourceKey;
	}


	function schudleDraw ( ) {
	    if ( fDrawSchulded === false ) {
		fDrawSchulded = true;
		requestAnimationFrame( drawGraph );
	    }
	}

	function drawGraph ( ) {
	    fDrawSchulded = false;

	    resizeGl( fGl );

	    fGl.clear(fGl.COLOR_BUFFER_BIT | fGl.DEPTH_BUFFER_BIT);

	    for ( var i = 0 ; i < fViews.length ; i++ ) {
		fViews[i].doDraw( );
	    }
	}
    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }

    function resizeGl ( gl ) {
	var width = gl.canvas.clientWidth;
	var height = gl.canvas.clientHeight;
	if (gl.canvas.width != width ||
	    gl.canvas.height != height) {
	    gl.canvas.width = width;
	    gl.canvas.height = height;
	}
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

}





function doGlDraw ( gl, glVars, fieldsCount,
		    xMin, xMax, yMin, yMax,
		    timeMin, timeMax, hwid,
		    top, left, width, height, data, color ) {
    var glWidth  = gl.canvas.clientWidth;
    var glHeight = gl.canvas.clientHeight;

    var translation = vec3.create();
    var perspectiveMatrix = mat4.create();

    // Set up the canvas units to be in pixles and
    // move the origan to the top left.
    mat4.ortho(perspectiveMatrix, 0, glWidth, 0, glHeight, 0.1, 100.0 );
    vec3.set(translation, glWidth/2, glHeight, 0);
    mat4.translate(perspectiveMatrix, perspectiveMatrix, translation);

    var matrix = mat4.create();
    mat4.identity(matrix);
    
    // BUG: I don't understand the need for the -10 z translation
    //vec3.set(translation, left -width, -top, -10 );
    vec3.set(translation, left - width, -top - height, -10 );
    mat4.translate(matrix, matrix, translation);

    var xScale = width/(xMax - xMin);
    var yScale = height/(yMax - yMin);

    var pointSize = Math.max( 2, 0.05 * xScale );

    // Scale from base units to pixles
    vec3.set(translation, xScale, yScale, 1);
    mat4.scale(matrix, matrix, translation);
    
    // Move data origan to bottom left
    vec3.set(translation, -xMin, -yMin, 0);
    mat4.translate(matrix, matrix, translation);


    var pUniform = gl.getUniformLocation(glVars.shader, "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, perspectiveMatrix);

    var mvUniform = gl.getUniformLocation(glVars.shader, "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, matrix);

    var xMaxLoc = gl.getUniformLocation(glVars.shader, "xMax");
    var xMaxClip =  ( ( left + width ) - glWidth/2)/(glWidth/2);
    gl.uniform1f(xMaxLoc, xMaxClip);

    var xMinLoc = gl.getUniformLocation(glVars.shader, "xMin");
    var xMinClip =  (left - glWidth/2 )/(glWidth/2);
    gl.uniform1f(xMinLoc, xMinClip);

    var yMaxLoc = gl.getUniformLocation(glVars.shader, "yMax");
    var yMaxClip = (glHeight/2 - top )/(glHeight/2);
    gl.uniform1f(yMaxLoc, yMaxClip);

    var yMinLoc = gl.getUniformLocation(glVars.shader, "yMin");
    var yMinClip =  (glHeight/2 - (top + height) )/(glHeight/2);
    gl.uniform1f(yMinLoc, yMinClip);

    var selectionMinLoc = gl.getUniformLocation(glVars.shader, "selectionMin");
    gl.uniform1f(selectionMinLoc, timeMin/1000);

    var selectionMaxLoc = gl.getUniformLocation(glVars.shader, "selectionMax");
    gl.uniform1f(selectionMaxLoc, timeMax/1000);

    var pointSizeLoc = gl.getUniformLocation(glVars.shader, "uPointSize");
    gl.uniform1f(pointSizeLoc, pointSize );

    if ( hwid === undefined )
	hwid = 0;

    var hwidLoc = gl.getUniformLocation(glVars.shader, "hwid");
    gl.uniform1f( hwidLoc, hwid );

    var colorLoc = gl.getUniformLocation(glVars.shader, "color");
    gl.uniform3fv(colorLoc, color );


    for ( var i = 0 ; i < data.length ; i++ ) {
	var info = data[i];

	gl.vertexAttribPointer(glVars.selection, 2, gl.FLOAT, false, 4 * fieldsCount, info.dataOffset * 4);
	gl.vertexAttribPointer(glVars.pointsX, 2, gl.FLOAT, false, 4 * fieldsCount, 4 + info.dataOffset * 4);
	// BUG: even thou we will not use .yzw they could walk of the end of the buffer :(
	gl.vertexAttribPointer(glVars.pointsY, 2, gl.FLOAT, false, 4 * fieldsCount, 8 + info.dataOffset * 4);
	gl.vertexAttribPointer(glVars.hwid, 2, gl.FLOAT, false, 4 * fieldsCount, 12 + info.dataOffset * 4);
	gl.vertexAttribPointer(glVars.good, 2, gl.FLOAT, false, 4 * fieldsCount, 16 + info.dataOffset * 4);

	gl.drawArrays(gl.POINTS, 0, info.pointsCount);
    }

    return;
}

function initShaders( root, gl ) {
    var fragmentShader = getShader(root, gl, "fragment-shader");
    var vertexShader   = getShader(root, gl, "vertex-shader");
    
    // Create the shader program
    
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    // If creating the shader program failed, alert
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log("Unable to initialize the shader program.");
    }
    
    gl.useProgram(shaderProgram);
    
    var vertexPositionAttributeX = gl.getAttribLocation(shaderProgram, "aVertexPositionX");
    gl.enableVertexAttribArray(vertexPositionAttributeX);

    var vertexPositionAttributeY = gl.getAttribLocation(shaderProgram, "aVertexPositionY");
    gl.enableVertexAttribArray(vertexPositionAttributeY);
    
    var selection = gl.getAttribLocation(shaderProgram, "aSelection");
    gl.enableVertexAttribArray(selection);

    var hwid = gl.getAttribLocation(shaderProgram, "aHwid");
    gl.enableVertexAttribArray(hwid);

    var good = gl.getAttribLocation(shaderProgram, "aGood");
    gl.enableVertexAttribArray(good);


    return { pointsX   : vertexPositionAttributeX, 
	     pointsY   : vertexPositionAttributeY,
	     selection : selection,
	     hwid      : hwid,
	     good      : good,
	     shader    : shaderProgram }

}


function getShader(root, gl, id) {
    var shaderScript = root.querySelector( "#" + id );
    
    if (!shaderScript) {
	console.log( "could not find %s", id, root, document); //BOOG
        return null;
    }
    
    // Walk through the source element's children, building the
    // shader source string.
    
    var theSource = "";
    var currentChild = shaderScript.firstChild;
    
    while(currentChild) {
        if (currentChild.nodeType == 3) {
	    theSource += currentChild.textContent;
        }
        
        currentChild = currentChild.nextSibling;
    }
    
    // Now figure out what type of shader script we have,
    // based on its MIME type.
    
    var shader;
    
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;  // Unknown shader type
    }
    
    // Send the source to the shader object
    
    gl.shaderSource(shader, theSource);
    
    // Compile the shader program
    
    gl.compileShader(shader);
    
    // See if it compiled successfully
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        return null;
    }
    
    return shader;
}
