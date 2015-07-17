"use strict";


// register a new element called proto-element
Polymer({
    is: "dc-gl-chart",
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
    },
    // add a callback to the element's prototype
    ready: function() {
	this.viz = loadGraph( this, this.source, this.data, this.start, this.end );
    },

    
});


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
    return init;

    function init ( fFetcher, fSource, fType, fStart, fEnd ) {
	var fBatcher         = new BatchAction ( );
	var self             = {};
	var fRequestedTimes  = {};
	var fDataTiles       = {};
	var fListeners       = [];
	var fNewData         = [];
	var fEventsTriggeres = [];

	self.addListener = addListener;
	self.getTile     = getTile;
	self.getRange    = getRange;
	self.getStart    = getStart;

	getData( fFetcher, fSource, fType, fStart, fEnd, gotData, noData );

	return self;

	function addListener ( callback, options ) {
	    fListeners.push( [ callback, options ] );
	}

	function getTile ( tileTime ) {
	    return fDataTiles[ tileTime ];
	}

	function getRange ( start, end ) {
	    // BOOG something like this but we probbly should track the range.
	    //getData( fFetcher, fSource, fType, start, end, gotData, noData );
	}

	function getStart ( ) {
	    return fStart;
	}

	function triggerEvents (  ) {
	    fBatcher.batch( triggerEventsWorker );
	}

	function triggerEventsWorker ( ) {
	    for ( var i = 0 ; i < fListeners.length ; i++ ) {
		var callbackInfo = fListeners[i]; 
		callbackInfo[0]( fNewData.slice(0), callbackInfo[1] );
	    }

	    fNewData = [];
	}

	function gotData ( dataArray, tileStart ) {
	    fNewData.push( dataArray );
	    fDataTiles[ tileStart ] = dataArray;
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


    function snapBound ( time, bucketSize ) {
	return Math.floor( time / bucketSize ) * bucketSize;
    }

    function makePath ( dataSource, type, tileTime ) {
	var result = '/data/' + dataSource + ':' + type + ':' + tileTime + '.tile';
	return result;
    }



};

var ScatterPlot = new function ( ) {
    var sId   = 0;
    return constructor;

    function constructor ( root, start, end ) {

	var self = init( root, start, end );

	return self;
    }

    function init ( fRoot, fStart, fEnd ) {
	var self = {};

	var fDoZoomY     = false;
	var fScaleX      = 1;
	var fTranslateX  = 0;
	var fScaleY      = 1;
	var fTranslateY  = 0;
	var fZoom        = d3.behavior.zoom();
	var fListeners   = [];
	var fId          = sId++;

	d3.select(fRoot).call(fZoom);
        fZoom
	    .on("zoom", doZoom)
	;
	
	initZoomY();

	self.id          = id;
	self.doDraw      = doDraw;
	self.addListener = addListener;
	self.setZoom     = setZoom;

	return self;

	function id ( ) {
	    return fId;
	}


	function addListener ( callback ) {
	    fListeners.push( callback );
	}


	function setZoom ( xScaleChange, yScaleChange, xTranslateChage, yTranslateChage ) {
	    var newScale  = fZoom.scale();
	    var translate = fZoom.translate();
	    
	    var elementBox = fRoot.getBoundingClientRect();
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    if ( fDoZoomY === false ) {
		newScale     *= xScaleChange;
		translate[0] -= ( width * xTranslateChage ) * newScale;
		fScaleX       = newScale;
		fTranslateX   = translate[0];
	    }
	    
	    else {
		newScale     *= yScaleChange;
		translate[1] -= ( height * yTranslateChage ) * newScale;
		fScaleY       = newScale;
		fTranslateY   = translate[1];
	    }
	    
	    fZoom.scale( newScale );
	    fZoom.translate( translate );
	}


	function initZoomY ( ) {
	    var checkbox = fRoot.querySelector( "#zoom-y" );
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

	    if ( fDoZoomY === true ) {
		yScaleChange    = scale/fScaleY;
		yTranslateChage = (fTranslateY -translate[1])/scale/height;

		fScaleY     = scale;
		fTranslateY =  translate[1];
	    }
	    
	    else {
		xScaleChange    = scale/fScaleX;
		xTranslateChage = (fTranslateX -translate[0])/scale/width;

		fScaleX     = scale;
		fTranslateX = translate[0];
	    }

	    triggerEvents( xScaleChange, yScaleChange, xTranslateChage, yTranslateChage );
	}

	function doDraw ( gl, guffers, glVars, 
			  valueMin, valueMax, data ) {
	    var elementBox = fRoot.getBoundingClientRect();
	    var top        = fRoot.offsetTop;
	    var left       = fRoot.offsetLeft;
	    var width      = elementBox.width;
	    var height     = elementBox.height;

	    doGlDraw( gl, guffers, glVars, 
		      fTranslateX, fTranslateY, fScaleX, fScaleY,
		      fStart, fEnd, valueMin, valueMax, 
		      top, left, width, height, data );

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

	var glVars  = initShaders( root, gl );
	var buffers = initBuffers( gl, glVars );

	gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

	var self = init( root, fetcher, canvas, gl, buffers, glVars, width, height );

	return self;
    }

    function init ( fRoot, fFetcher, fCanvas, fGl, fBuffers, fGlVars, fWidth, fHeight ) {
	var self = { };
	self.addView = addView;

	var fSourceKeys    = [];
	var fDataSources   = {};
	var fSourceBuffers = {};
	var fViewsBySource = {};
	var fDrawSchulded  = false;
	var fViews         = [];
	var fValueMin      = undefined;
	var fValueMax      = undefined;

	return self;

	function addView ( Type, selector, sourceName, typeName,
			   indexStart, indexEnd, options ) {

	    var plotRoot = fRoot.querySelector( selector );

	    if ( plotRoot === undefined ) {
		console.log( "could not find element '%s'", selector );
		return;
	    }

	    var sourceKey = addData( sourceName, typeName, indexStart, indexEnd );

	    var plot = Type( plotRoot, indexStart, indexEnd );
	    fViews.push( plot );
	    fViewsBySource[ sourceKey ].push( plot );

	    plot.addListener( plotChange );
	}

	function plotChange ( plot, xScaleChange, yScaleChange, xTranslateChage, yTranslateChage ) {
	    var changedId = plot.id();
	    for ( var i = 0 ; i < fViews.length ; i++ ) {
		var current = fViews[ i ];
		if ( current.id() === changedId )
		    continue;

		current.setZoom( xScaleChange, yScaleChange, xTranslateChage, yTranslateChage );
	    }

	    schudleDraw();
	}

	function addData ( sourceName, typeName, start, end ) {

	    var sourceKey = makeSourceKey( sourceName, typeName );
	    
	    var source = fDataSources[ sourceKey ];

	    if ( source === undefined ) {
		source = new RemoteData ( fFetcher, sourceName, typeName, start, end );
		fDataSources[ sourceKey ] = source;
		fSourceBuffers[ sourceKey ] = [];
		fViewsBySource[ sourceKey ] = [];
		fSourceKeys.push( sourceKey );
		source.addListener( handleNewData, sourceKey );
	    }

	    else {
		source.getRange( start, end );
	    }

	   return sourceKey;
	}

	function handleNewData ( tileArrays, sourceKey ) {
	    for ( var i = 0 ; i < tileArrays.length ; i++ ) {
		var tileArray   = tileArrays[ i ];
		var tilePointer = loadBuffer( tileArray );
		var source      = fDataSources[ sourceKey ];
		var start       = source.getStart();
		var results     = loadGlBuffer( fGl, tilePointer, start );

		if ( fValueMin === undefined || fValueMin > results.minY )
		    fValueMin = results.minY;

		if ( fValueMax === undefined || fValueMax < results.maxY )
		    fValueMax = results.maxY;

		fSourceBuffers[ sourceKey ].push( results );
	    }

	    schudleDraw();
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

	    for ( var i = 0 ; i < fSourceKeys.length ; i++ ) {
		var sourceKey = fSourceKeys[i];
		var data      = fSourceBuffers[sourceKey];
		var views     = fViewsBySource[sourceKey];

		for ( var j = 0 ; j < views.length ; j++ ) {
		    views[j].doDraw( fGl, fBuffers, fGlVars, 
				  fValueMin, fValueMax, data);
		}
	    }

	}
    }

    function makeSourceKey ( sourceName, typeName ) {
	return sourceName + "\0" + typeName;
    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function loadGlBuffer ( gl, tilePointer, minTime ) {

	var pointsCount = 0 | 0;
	
	var minIndex;
	var maxIndex;
	var minValue;
	var maxValue;

	var iterator = initIterator( tilePointer );

	// BUG: this loop should be pulled out to tile creation.
	while ( nextValue( tilePointer, iterator ) !== 0 ) {
	    pointsCount++;

	    var time = readValue( iterator, 0 );

	    if ( minIndex === undefined || minIndex > time )
		minIndex = time;

	    if ( maxIndex === undefined || maxIndex < time )
		maxIndex = time;

	    var value = readValue( iterator, 1 );

	    if ( minValue === undefined || minValue > value )
		minValue = value;

	    if ( maxValue === undefined || maxValue < value )
		maxValue = value;
	}

	finishIterator( iterator );
	var glData = new Float32Array(pointsCount*2);

	var iterator = initIterator( tilePointer );

	for ( var j = 0 ; nextValue( tilePointer, iterator ) !== 0; j += 2 ) {
	    glData[j]   = readValue( iterator, 0 ) - minTime;
	    glData[j+1] = readValue( iterator, 1 );
	}

	finishIterator( iterator );

	var bufferPointer = gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, bufferPointer);
	gl.bufferData(gl.ARRAY_BUFFER, glData, gl.STATIC_DRAW);

	return {
	    mixX          : minIndex,
	    maxX          : maxIndex,
	    minY          : minValue, 
	    maxY          : maxValue, 
	    pointsCount   : pointsCount, 
	    bufferPointer : bufferPointer,
	    tilePointer   : tilePointer,
	};
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


function loadGraph ( root, sourceName, typeName, startDate, endDate ) {

    var startTime = startDate.getTime();
    var endTime   = endDate.getTime();

    var fetcher = new DataFetcher ( );

    var viz = Viz( root, fetcher );

    
    viz.addView( ScatterPlot, "#plot1",
		 sourceName, typeName, startTime, endTime,
		 {  } );

    viz.addView( ScatterPlot, "#plot2",  
		 sourceName, typeName, startTime, endTime,
		 {  } );

    
    return viz;
}


function doGlDraw ( gl, glBuffers, glVars,
		    fTranslateX, fTranslateY, fScaleX, fScaleY,
		    xMin, xMax, yMin, yMax,
		    top, left, width, height, data ) {

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
    vec3.set(translation, -(width/2), -top, -10 );
    mat4.translate(matrix, matrix, translation);

    // Translate based on zoom
    vec3.set(translation,  fTranslateX, -fTranslateY, 0 );
    mat4.translate(matrix, matrix, translation);

    // Scale based on zoom
    vec3.set(translation, fScaleX, fScaleY, 1);
    mat4.scale(matrix, matrix, translation);

    var xScale = width/(xMax - xMin);
    var yScale = height/(yMax - yMin);

    // Scale from base units to pixles
    vec3.set(translation, xScale, yScale, 1);
    mat4.scale(matrix, matrix, translation);

    // Move data origan to bottom left
    vec3.set(translation, 0, yMin, 0);
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

    for ( var i = 0 ; i < data.length ; i++ ) {
	var info = data[i];
	gl.bindBuffer(gl.ARRAY_BUFFER, info.bufferPointer);
	gl.vertexAttribPointer(glVars.points, 2, gl.FLOAT, false, 0, 0);

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
    
    var vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);
    
    return { points : vertexPositionAttribute, shader : shaderProgram }

}

function initBuffers( gl, glVars ) {
    
    // Create a buffer for the square's vertices.
    
    var squareVerticesBuffer = gl.createBuffer();
    
    // Select the squareVerticesBuffer as the one to apply vertex
    // operations to from here out.
    
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBuffer);
    
    // Now create an array of vertices for the square. Note that the Z
    // coordinate is always 0 here.
    
    var vertices = [
        1.0,  1.0,
	    -1.0,  1.0,
        1.0, -1.0,
	    -1.0, -1.0
    ];
    
    // Now pass the list of vertices into WebGL to build the shape. We
    // do this by creating a Float32Array from the JavaScript array,
    // then use it to fill the current vertex buffer.
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    // Draw the square by binding the array buffer to the square's vertices
    // array, setting attributes, and pushing it to GL.
    
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBuffer);
    gl.vertexAttribPointer(glVars.points, 2, gl.FLOAT, false, 0, 0);
    

    return { points : squareVerticesBuffer };
}



function getShader(root, gl, id) {
    var shaderScript = root.querySelector( "#" + id );
    
    if (!shaderScript) {
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
