"use strict";

var BUCKET_SIZE = 24 * 60 * 60 * 1000;
var requestedTimes = {};

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

    function constructor ( root, start, end ) {
	var canvas  = root.querySelector( "#chart" );
	var gl = canvas.getContext("webgl");
	var plotElment = root.querySelector( "#plot-svg" );

	var width  = canvas.clientWidth;
	var height = canvas.clientHeight;

	var glVars  = initShaders( root, gl );
	var buffers = initBuffers( gl, glVars );

	gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

	console.log( "width %s, height %s", width, height, canvas );

	var x = d3.scale.linear()
	    .range([0, 1000.0]);

	var y = d3.scale.linear()
	    .range([-700.0, 0]);


	var data = [];
	var drawSchulded = false;

	var self = init( data, root, plotElment, canvas, gl, buffers, glVars, x, y, start, end, drawSchulded, width, height );

	return self;
    }

    function init ( fData, fRoot, fPlotElement, fCanvas, fGl, fBuffers, fGlVars, fX, fY, fStart, fEnd, fDrawSchulded, fWidth, fHeight ) {
	var self = { };
	self.updateGraph = updateGraph;
	self.setYZoom = setYZoom;

	fX.domain([fStart, fEnd]).nice();
	fY.domain([-1500,1500]).nice();

	var fAccurecy = 0;
	var fValueMin = -1500;
	var fValueMax = 1500;
	var fYZoom = 1.0;
	var fMaxPoints   = Math.pow(10, 6);
	var fPointsCount = 0;
	var fDataArray   = new Float32Array(fMaxPoints*2);

	var zoom = d3.behavior.zoom();
	d3.select(fPlotElement).call(zoom);
        zoom
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
	    	
	    var results = 
		plotPoints([buffer], fGl, fBuffers, fGlVars, fX, fY, fAccurecy,
			   fMaxPoints, fPointsCount, fDataArray, fStart, fEnd,
			   fValueMin, fValueMax);
		
	    fDataArray   = results.data;
	    fPointsCount = results.pointsCount;
	    fValueMin    = results.minY;
	    fValueMax    = results.maxY;
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
	    var translate = zoom.translate();
	    var scale     = zoom.scale();

	    var elementBox = fPlotElement.getBoundingClientRect();
	    var top        = fPlotElement.offsetTop;
	    var left       = fPlotElement.offsetLeft;
	    var width      = elementBox.width;
	    var height     = elementBox.height;
	    console.log( "offsetTop %s, offsetLeft %s, width %s, height %s", top, left, width, height ); //BOOG


	    doGlDraw( fGl, fBuffers, fGlVars, fPointsCount, fDataArray, translate, scale,
		    fStart, fEnd, fValueMin, fValueMax, top, left, width, height );
	}

	function addData ( buffer ) {
	    fData.push( buffer );
	    fData.sort( tileCmp );
	}

    }

    function tileCmp ( a, b ) {
	return readStartTime(a) - readStartTime(b);
    }


    function plotPoints ( data, gl, buffers, glVars, xScale, yScale, accuracy,
			fMaxPoints, fPointsCount, fDataArray, xMin, xMax, yMin, yMax ) {
	var lastX   = undefined;
	var lastY   = undefined;

	var totalPoints = 0 | 0;
	var usedPoints  = 0 | 0;
	
	var minValue = yMin;
	var maxValue = yMax;

	for ( var i = 0 ; i < data.length ; i++ ) {

	    var buffer   = data[i];
	    var iterator = initIterator( buffer );

	    inner:
	    while ( nextValue( buffer, iterator ) !== 0 ) {
		totalPoints++;
		var value = readValue( iterator );

		if ( minValue === undefined || minValue > value )
		    minValue = value;

		if ( maxValue === undefined || maxValue < value )
		    maxValue = value;
	    }
	    finishIterator( iterator );
	}
	
	if ( fPointsCount + totalPoints > fMaxPoints ) {
	    console.log("toooo many points %d > %d",
			fPointsCount + totalPoints, fMaxPoints );

	    return;
	}

	var startOffset = fPointsCount;
	fPointsCount += totalPoints;

	for ( var i = 0, j = startOffset ; i < data.length ; i++ ) {

	    var buffer   = data[i];
	    var iterator = initIterator( buffer );

	    for ( ;nextValue( buffer, iterator ) !== 0; j++ ) {
		var value = readValue( iterator );
		var time  = readTime( iterator );

		var x = time  - xMin;
		var y = value;
		
		usedPoints++;

		lastX = x;
		lastY = y;
		
		var data_index = j*2;
		fDataArray[data_index+0] = x;
		fDataArray[data_index+1] = y;
	    }

	    finishIterator( iterator );

	}

	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.points);
	gl.bufferData(gl.ARRAY_BUFFER, fDataArray, gl.STATIC_DRAW);

	return {minY:minValue, maxY:maxValue, pointsCount: fPointsCount, 
		data:fDataArray };
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

    function doGlDraw ( gl, glBuffers, glVars, pointsCount, pointData, translate, scale,
		      xMin, xMax, yMin, yMax, top, left, width, height ) {

	resize( gl );

	var glWidth  = gl.canvas.clientWidth;
	var glHeight = gl.canvas.clientHeight;

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

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
	vec3.set(translation,  translate[0], 0, 0 );
	mat4.translate(matrix, matrix, translation);

	// Scale based on zoom
	vec3.set(translation, scale, 1, 1);
	mat4.scale(matrix, matrix, translation);

	var xScale = width/(xMax - xMin);
	var yScale = height/(yMax - yMin);

	// Scale from base units to pixles
	vec3.set(translation, xScale, yScale, 1);
	mat4.scale(matrix, matrix, translation);

	// ??? why do we need this agin?
	vec3.set(translation, 0, yMin, 0);
	mat4.translate(matrix, matrix, translation);

	gl.bindBuffer(gl.ARRAY_BUFFER, glBuffers.points);
	gl.vertexAttribPointer(glVars.points, 2, gl.FLOAT, false, 0, 0);

	var pUniform = gl.getUniformLocation(glVars.shader, "uPMatrix");
	gl.uniformMatrix4fv(pUniform, false, perspectiveMatrix);

	var mvUniform = gl.getUniformLocation(glVars.shader, "uMVMatrix");
	gl.uniformMatrix4fv(mvUniform, false, matrix);

	gl.drawArrays(gl.POINTS, 0, pointsCount);
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
            alert("Unable to initialize the shader program.");
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
            alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            return null;
	}
	
	return shader;
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
    

    var viz = Viz( root, startTime, endTime );

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
