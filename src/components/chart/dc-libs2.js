var BatchAction = new function ( ) {
    var LATER = Promise.resolve(true);

    return init;

    function init ( ) {
	
	var fBatchSchulded = false;
	var fWork           = {};

	var self = {};

	self.batch = batch;

	return self;

	function batch ( callback, args ) {
	    if ( fWork[ callback.name ] === undefined ) {
		fWork[ callback.name ] = [ callback, args ];
	    }

	    if ( fBatchSchulded === false ) {
		LATER.then( doBatches );
		fBatchSchulded = true;
	    }
	}

	function doBatches ( ) {
	    fBatchSchulded = false;
	    var work = Object.keys( fWork );

	    for ( var i = 0 ; i < work.length ; i++ ) {
		var job = fWork[work[i]];
		job[0].apply( job[0], job[1] );
	    }

	    fWork = {};
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

    function factory ( fFetcher, fSource, fType, fStart, fEnd, projection, xRange, yRange, color ) {

	var fColor      = new Float32Array( color );
	var fRanges     = [];
	var fSelectons  = [];
	var fProjection = projection.slice(0);

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

	return init( fFetcher, 
		     fSourceId, fSource, fType, 
		     fStart, fEnd,
		     fProjection,
		     fRanges, fSelectons, 
		     fColor );
    }

    function init ( fFetcher, 
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
	    fBatcher.batch( triggerEventsWorker );
	}

	function triggerEventsWorker ( ) {
	    for ( var i = 0 ; i < fListeners.length ; i++ ) {
		var callbackInfo = fListeners[i]; 
		callbackInfo[0]( self, fNewData.slice(0), callbackInfo[1] );
	    }

	    fNewData = [];
	}

	function gotData ( dataArray, tileStart ) {
	    fNewData.push( dataArray );
	    triggerEvents( );
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


var ZoomHandler = new function ( ) {
    return constructor;

    function constructor ( fRoot, fGroup, fLockZoom, fX, fY ) {

	var self = {};

	if ( fX === undefined )
	    fX = d3.scale.linear();

	if ( fY === undefined )
	    fY = d3.scale.linear();

	var fDoZoomY     = false;
	var fScaleX      = 1;
	var fTranslateX  = 0;
	var fScaleY      = 1;
	var fTranslateY  = 0;
	var fZoom        = d3.behavior.zoom();
	var fListeners   = [];

	initScales();

	d3.select(fRoot).call(fZoom);

        fZoom
	    .x(fX)
	    .y(fY)
	    .on("zoom", doZoom)
	;
	
	initZoomY();

	self.domainZoomed = domainZoomed;
	self.addListener  = addListener;
	self.getScale     = getScale;
	self.getTranslate = getTranslate;
	self.setXDomain   = setXDomain;
	self.setYDomain   = setYDomain;

	return self;

	function initScales ( ) {
	    var elementBox = fRoot.getBoundingClientRect();
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    fX.range( [width, 0] );
	    fY.range( [0, height] );

	    fZoom
		.x(fX)
		.y(fY)
	    ;
	}


	function domainZoomed ( ) {
	    var xDomain = fX.domain();
	    var yDomain = fY.domain();

	    return { 
		xMin : xDomain[0], 
		xMax : xDomain[1], 
		yMin : yDomain[0], 
		yMax : yDomain[1], 
	    };
	}

	function setXDomain ( minVal, maxVal ) {
	    initScales(); //BUG: this should be elewhere

	    fX.domain([minVal, maxVal] );
	    fZoom.x(fX);
	}

	function setYDomain ( minVal, maxVal ) {
	    fY.domain([minVal, maxVal] );
	    fZoom.y(fY);
	}
	
	function addListener ( callback ) {
	    fListeners.push( callback );
	}




	function getScale ( ) {
	    return [ fScaleX, fScaleY ];
	}


	function getTranslate ( ) {
	    return [ fTranslateX, fTranslateY ];
	}


	function initZoomY ( ) {
	    var checkbox = fRoot.querySelector( "#zoom-y" );

	    if ( checkbox === null )
		return;

	    checkbox.onclick = function ( ) {

		var translate = fZoom.translate();

		if ( checkbox.checked === false ) {
		    fZoom.scale( fScaleX );
		    translate[0] = fTranslateX;
		}
		
		else {
		    fZoom.scale( fScaleY );
		    translate[1] = fTranslateY;
		}

		fZoom.translate( translate );

		fDoZoomY = checkbox.checked ;
	    }
	}

	function triggerEvents ( xScaleChange, yScaleChange, xTranslateChage, yTranslateChage ) {
	    for ( var i = 0 ; i < fListeners.length ; i++ ) {
		fListeners[i]( self, xScaleChange, yScaleChange, xTranslateChage, yTranslateChage );
	    }
	}

	function doZoom ( ) {
	    var translate = fZoom.translate();
	    var scale     = fZoom.scale();

	    var xScaleChange    = 1;
	    var yScaleChange    = 1;
	    var xTranslateChage = 0;
	    var yTranslateChage = 0;

	    var elementBox = fRoot.getBoundingClientRect();
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    if ( fLockZoom === true || fDoZoomY === true ) {
		yScaleChange    = scale/fScaleY;
		yTranslateChage = (fTranslateY -translate[1])/scale/height;

		fScaleY     = scale;
		fTranslateY =  translate[1];
	    }
	    
	    if ( fLockZoom === true || fDoZoomY === false ) {
		xScaleChange    = scale/fScaleX;
		xTranslateChage = (fTranslateX -translate[0])/scale/width;

		fScaleX     = scale;
		fTranslateX = translate[0];
	    }

	    triggerEvents( xScaleChange, yScaleChange, xTranslateChage, yTranslateChage );

	}
    }
};

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

	return self;

	function id ( ) {
	    return fId;
	}

	function getGroup ( ) {
	    return fGroup;
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
	var fMinY        = undefined;
	var fMaxY        = undefined;
	var fMinX        = undefined;
	var fMaxX        = undefined;
	var fGlVars      = initShaders( fRoot, fGl );
	var fZoom        = d3.behavior.zoom();
	var fX           = d3.scale.linear();
	var fY           = d3.scale.linear();
	
        fZoom
	    .x(fX)
	    .y(fY)
	    .on("zoom", updateSelections)
	;

	d3.select(fRoot).call(fZoom);

	self.doDraw       = doDraw;
	self.addData      = addData;
	

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

		updateKey( projection[0], results, xDomain[0], xDomain[1] );
		updateKey( projection[1], results, yDomain[0], yDomain[1] );
	    }


	    var keys = Object.keys( results );

	    
	    for ( var i = 0 ; i < keys.length ; i++ ) {
		var key   = keys[i];
		var range = results[key];
		
		fSelectons.setSelection( key, range.min, range.max );
	    }

	}

	function addData ( sourceObject ) {

	    var bufferInfo  = { 
		offset    : 0, 
		data      : new Float32Array(1024 * 1024), 
		glPointer : fGl.createBuffer(),
	    };

	    var sourceConfig = {};

	    sourceConfig.bufferInfo   = bufferInfo;
	    sourceConfig.loadFunction = identityFunction;
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

		if ( valueMin === undefined )
		    valueMin = fMinY;

		if ( valueMax === undefined )
		    valueMax = fMaxY;

		fGl.bindBuffer(fGl.ARRAY_BUFFER, bufferInfo.glPointer);
		
		doGlDraw( fGl, fGlVars, fieldsCount,
			  indexMin, indexMax, valueMin, valueMax,
			  timeMin, timeMax,
			  top, left, width, height, data, color );
	    }

	}


	function handleNewData ( source, tileArrays, sourceConfig ) {

	    var projection   = sourceConfig.projection;
	    var loadFunction = sourceConfig.loadFunction;
	    var bufferInfo   = sourceConfig.bufferInfo;
	    var source       = sourceConfig.sourceObject;
	    var start        = source.getStart();
	    var end          = source.getEnd();
	    var sourceKey    = source.getId();

	    for ( var i = 0 ; i < tileArrays.length ; i++ ) {
		var tileArray    = tileArrays[ i ];
		var tilePointer  = loadBuffer( tileArray );

		var dataInfo =
		    loadGlBuffer( loadFunction, tilePointer, 
				  bufferInfo, start, end, projection );

		fSourceBuffers[ sourceKey ].push( dataInfo );

		if ( fMinY === undefined || fMinY > dataInfo.minY )
		    fMinY = dataInfo.minY;

		if ( fMaxY === undefined || fMaxY < dataInfo.maxY )
		    fMaxY = dataInfo.maxY;

		freeBuffer( tilePointer );
	    }

	    var elementBox = fRoot.getBoundingClientRect();
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    	    
	    fX.range( [0, width] );
	    fY.range( [height, 0] );

	    fX.domain(
		[ fSelectons.getMin( 'lon' ),
		  fSelectons.getMax( 'lon' ) ] );

	    fY.domain(
		[ fSelectons.getMin( 'lat' ),
		  fSelectons.getMax( 'lat' ) ] );

	    fZoom.x(fX);
	    fZoom.y(fY);
	    
	    /*
	    fX.domain( [source.getStart(), source.getEnd()] );
	    fZoom.x(fX);

	    if ( source.getMin() !== undefined && source.getMax() !== undefined )
		fY.domain([source.getMin(), source.getMax()]);

	    else
		fY.domain([fMinY, fMaxY]);
	    
	    fZoom.y(fY);
	    */

	    fGl.bindBuffer(fGl.ARRAY_BUFFER, bufferInfo.glPointer);
	    fGl.bufferData(fGl.ARRAY_BUFFER, bufferInfo.data, fGl.STATIC_DRAW);

	    fViz.schudleDraw();
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

	var self = BasePlot( fRoot, options, fX, fY );

	return init( self, fViz, fRoot, fGl, fSelectons, fColumn, fX, fY );
    }

    function init ( self, fViz, fRoot, fGl, fSelectons, fColumn, fX, fY ) {

	var fSources       = [];
	var fListeners     = [];
	var fD3Data        = {};
	var fSourceBuffers = {};
	var fMinY          = undefined;
	var fMaxY          = undefined;
	var fMinX          = undefined;
	var fMaxX          = undefined;
	var fGroup         = undefined;
	var fZoom          = d3.behavior.zoom();
	var fBatcher       = new BatchAction ( );

	var fChart       = undefined;
	var fXAxis       = undefined;
	var fYAxis       = undefined;
	var fDataBuffer  = new Float32Array( 1000 * 2 );
	var fDays        = 0;

	var fMargin = {top: 30, right: 60, bottom: 80, left: 60};

	initChart( );

	fSelectons.addListener( selectionChanged );

	self.doDraw  = doDraw;
	self.addData = addData;

	return self;

	function selectionChanged ( keys ) {
	    fBatcher.batch( selectionChangedWorker );
	}
	

	function selectionChangedWorker () {
	    fMinY = undefined;
	    fMaxY = undefined;

	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var source = fSources[i];
		
		recomputeData( fSources[i] );

	    }

	    fMinX = fSelectons.getMin( 'time' );
	    fMaxX = fSelectons.getMax( 'time' );

	    fX.domain( [fMinX, fMaxX] );
	    fZoom.x(fX);

	    fY.domain([0, fMaxY]);
	    fViz.schudleDraw();
	}


	function resize ( ) {

	    var elementBox = fRoot.getBoundingClientRect();

	    width  = elementBox.width - fMargin.left - fMargin.right;
	    height = elementBox.height - fMargin.top - fMargin.bottom;
	    
	    var xDomain     = fX.domain();
	    var domainDelta = xDomain[1].getTime() - xDomain[0].getTime();
	    var days        = domainDelta/1000/DAY;
	    var bandWidth   = width/days;

	    fGroup.rangeRoundBands([0, bandWidth], .1);

	    fX.range([0, width]);
	    fY.range([height, 0]);

	    fChart
	    	.attr("transform", "translate(" + fMargin.left + "," + fMargin.top + ")")
	    ;


	    fChart.select(".x-axis")
		.attr("transform", "translate(0," + height + ")")
		.call(fXAxis)
	    ;

	    fChart.select(".y-axis")
		.call(fYAxis)
	    ;
	}

	function initChart ( ) {
	    
	    var elementBox = fRoot.getBoundingClientRect();
	    
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


	    fZoom
		.x(fX)
		.on("zoom", doZoom)
	    ;

	    d3.select(fRoot).call(fZoom);

	    resize();
	}


	function doZoom ( ) {

	    var timeDomain = fX.domain( );
	    fSelectons.setSelection( 'time',
				     timeDomain[0].getTime(), 
				     timeDomain[1].getTime() );

	}

	function addData ( sourceObject ) {

	    var bufferInfo  = { 
		offset    : 0, 
		data      : new Float32Array(1024 * 1024), 
		glPointer : fGl.createBuffer(),
	    };

	    var sourceConfig = {};

	    sourceConfig.bufferInfo   = bufferInfo;
	    sourceConfig.loadFunction = identityFunction;
	    sourceConfig.sourceObject = sourceObject;
	    sourceConfig.projection   = sourceObject.getProjection();
	    sourceConfig.name         = "bob";

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
	    resize( );

	    var sourceData = [];
	    var sourceNames = [];

	    for ( var i = 0 ; i < fSources.length ; i++ ) {
		var source       = fSources[i].sourceObject;
		var color        = source.getColor();
		var sourceKey    = source.getId();
		var plotData     = fD3Data[ sourceKey ];
		if ( plotData !== undefined ) {
		    sourceData.push( [ i, fSources[i].name, plotData, color ] );
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

	    //console.log( "sourceData: ", sourceData ); //BOOG
	    var sources = fChart.selectAll( ".bar-chart-data" )
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
	    	.attr( 'width', fGroup.rangeBand() )
		.attr( 'height', function (d) { return height - fY( d[1] ) } )
	    ;

	    bars
		.attr( 'x', function (d) { return fX( d[0] ) } )
		.attr( 'y', function (d) { return fY( d[1] ) } )
	    	.attr( 'width', fGroup.rangeBand() )
		.attr( 'height', function (d) {  return height - fY( d[1] ) } )

	    ;

	    bars.exit()
		.remove()
	    ;
	}

	
	function recomputeData ( sourceConfig, dataInfo ) {
	    var projection   = sourceConfig.projection;
	    var bufferInfo   = sourceConfig.bufferInfo;
	    var source       = sourceConfig.sourceObject;
	    //BUG: I I should not have to do unit conversion hear!
	    var start        = source.getStart()/1000;
	    var sourceKey    = source.getId();

	    var data       = bufferInfo.data;
	    var stop       = bufferInfo.offset/projection.length;
	    
	    var minLat = fSelectons.getMin( "lat" );
	    var maxLat = fSelectons.getMax( "lat" );

	    var minLon = fSelectons.getMin( "lon" );
	    var maxLon = fSelectons.getMax( "lon" );

	    var minTime = fSelectons.getMin( "time" );
	    var maxTime = fSelectons.getMax( "time" );

	    fDays = Math.ceil( (maxTime - minTime)/(DAY * 1000) );
	    var firstDay = snapBound( minTime, DAY * 1000 );

	    if ( fDataBuffer.length * 2 < fDays ) {
		console.log( "extending data buffer to %s", fDays * 4 );
		// Expand to be twice the required number of days
		fDataBuffer = new float32array( fDays * 4 );
	    }

	    for ( var i = 0 ; i < fDays *2 ; i++ )
		  fDataBuffer[i] = 0;

	    for ( var i = 0 ; i < stop ; i++ ) {
		var index = i*projection.length;

		var lon = data[index];
		var lat = data[index+1];

		if ( !(
		           lon < maxLon 
			&& lon > minLon 
			&& lat > minLat 
			&& lat < maxLat ) )
		    continue;

		if ( minLon > lon || maxLon < lon )
		    continue;

		if ( minLat > lat || maxLat < lat ) 
		    continue;

		var day = snapBound( data[index+2] + start, DAY ) * 1000;

		
		if ( day < firstDay )
		    continue;
		
		var dataIndex = 2 * (day - firstDay)/(DAY * 1000);

		fDataBuffer[dataIndex] = day;
		fDataBuffer[dataIndex+1]++;
	    }

	    var resultData = [];

	    for ( var i = 0 ; i < fDays ; i++ ) {
		var index = i*2;
		var time  = fDataBuffer[index];
		var value = fDataBuffer[index+1];

		if ( fMinY === undefined || value )
		    fMinY = value;

		if ( fMaxY === undefined || fMaxY < value )
		    fMaxY = value;

		resultData.push( [time, value] );
	    }

	    fD3Data[sourceKey] = resultData;
	}


	function handleNewData ( source, tileArrays, sourceConfig ) {

	    var projection   = sourceConfig.projection;
	    var loadFunction = sourceConfig.loadFunction;
	    var bufferInfo   = sourceConfig.bufferInfo;
	    var source       = sourceConfig.sourceObject;
	    //BUG: I I should not have to do unit conversion hear!
	    var start        = source.getStart()/1000;
	    var end          = source.getEnd()/1000;
	    var sourceKey    = source.getId();

	    for ( var i = 0 ; i < tileArrays.length ; i++ ) {
		var tileArray    = tileArrays[ i ];
		var tilePointer  = loadBuffer( tileArray );

		var dataInfo =
		    loadGlBuffer( loadFunction, tilePointer, 
				  bufferInfo, start, end, projection );

		fSourceBuffers[ sourceKey ].push( dataInfo );

		freeBuffer( tilePointer );
	    }

	    fBatcher.batch( selectionChangedWorker );
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

	fSelections.addListener( schudleDraw );

	return self;

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

	    
	    var source = new RemoteData ( fFetcher, sourceName, typeName, start, end, projection, xRange, yRange, color );

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

	    resize( fGl );

	    fGl.clear(fGl.COLOR_BUFFER_BIT | fGl.DEPTH_BUFFER_BIT);

	    for ( var i = 0 ; i < fViews.length ; i++ ) {
		fViews[i].doDraw( );
	    }
	}
    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }

    function resize ( gl ) {
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
		    timeMin, timeMax,
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

    // Scale from base units to pixles
    vec3.set(translation, xScale, yScale, 1);
    mat4.scale(matrix, matrix, translation);
    
    // Move data origan to bottom left
    vec3.set(translation, -xMin -180, -yMin, 0);
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
    gl.uniform1f(pointSizeLoc, 2 );

    var hwidLoc = gl.getUniformLocation(glVars.shader, "uHwid");
    gl.uniform1f(hwidLoc, 0 );

    var colorLoc = gl.getUniformLocation(glVars.shader, "color");
    gl.uniform3fv(colorLoc, color );


    for ( var i = 0 ; i < data.length ; i++ ) {
	var info = data[i];

	gl.vertexAttribPointer(glVars.pointsX, 2, gl.FLOAT, false, 4 * fieldsCount, info.dataOffset * 4);
	// BUG: even thou we will not use .y it could walk of the end of the buffer :(
	gl.vertexAttribPointer(glVars.pointsY, 2, gl.FLOAT, false, 4 * fieldsCount, 4 + info.dataOffset * 4);
	gl.vertexAttribPointer(glVars.selection, 2, gl.FLOAT, false, 4 * fieldsCount, 8 + info.dataOffset * 4);
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
