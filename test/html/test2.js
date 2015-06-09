var start = Date.now();


var BucketSize = 24 * 60 * 60 * 1000;
var startTime  = 1412121600000;
var endTime    = startTime + BucketSize;

var requestedTimes = {};

console.log( "start time %s end time %s", new Date( startTime ), new Date ( endTime ) );

var graphs = [];

var bus1Graph = initGraph("bus1-container", "0906:bus1", "batt currents set");
var bus2Graph = initGraph("bus2-container", "0906:bus2", "batt currents set");


function snapBound ( time, bucketSize ) {
    return Math.floor( time / bucketSize ) * bucketSize;
}

function makePath ( dataSource, valueType, tileTime ) {
    var result = './data/' + dataSource + ':' + valueType + ':' + tileTime + '.tile';
    return result;
}

function getData ( source, valueType, start, end, handler ) {
    var tileStart  = snapBound( start, BucketSize );
    var requestMax = snapBound( end, BucketSize ) + BucketSize ;

    getDataWorker( source, valueType, tileStart, handler );

    // Defer the spicltive work
    Promise.resolve(true).then( function () {
	getDataWorker( source, valueType, tileStart - BucketSize, handler );
    
	for ( var i = tileStart ; i < requestMax ; i += BucketSize ) {
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

function initGraph ( nodeId, source, valueType ) {
    var options = {
	title: 'Missing',
	ylabel: 'Missing',
	labels: [ "time", "value" ],
	drawCallback: handleDraw,
	width : 1000,
	drawPoints: true,
	strokeWidth: 0.0,
	pointSize: 1.5,
    };
    
    var tileData = [];

    var graph = new Dygraph(document.getElementById(nodeId),
			    [[0,0]],
			    options);

    var graphObj = { graph : graph, dataGetter : getMyDate };

    graph.updateOptions({
	dateWindow : [startTime, endTime],
	title      : source + " " + '"' + valueType + '"',
	ylabel     : valueType,
	labels     : ['date', valueType],
    });

    graphs.push( graphObj );

    getMyDate ( startTime, endTime );

    return graph;

    function getMyDate ( startTime, endTime ) {
	if ( startTime != 0 ) //BUG: wont work for epoc tile
	    getData( source, valueType, startTime, endTime, handleData );
    }

    function handleData ( tile ) {

	var data = processTile( tile );

	for ( var i = 0 ; i < data.length ; i++ ) {
	    tileData.push( data[i] );
	}

	graph.updateOptions({
	    file : tileData,
	} );
    }
}




function doFetch ( file, handler ) {
    requestedTimes[ file ] = true;
    fetch(file)  
	.then( function(response) {  
	    if (response.status !== 200) {  
		console.log('Looks like there was a problem. Status Code: ' +  
			    response.status);  
		return;  
	    }

	    response.arrayBuffer()
		.then(handler)
		.catch(function(err) {
		    console.log("processing array buffer for %s:",file,  err);
		});  
	} )  
	.catch(function(err) {  
	    console.log('Fetch Error :-S', err);  
	});
}


function processTile ( tile ) {
    var buffer = loadBuffer( tile );
    var iterator = initIterator( buffer );

    var record = { time : undefined, value : undefined };

    var data = [];
    while ( nextValue( iterator, buffer, record ) ) {
	data.push( [new Date( record.time ), record.value] );
    }

    finishIterator( iterator );
    freeBuffer( buffer );

    return data;
}


function handleDraw ( updatedGraph ) {
    var newXY = updatedGraph.xAxisRange();

    for ( var i = 0 ; i < graphs.length ; i++ ) {
	var graphObj = graphs[ i ];
	var graph    = graphObj.graph;

	graphObj.dataGetter( newXY[0], newXY[1] );

	if ( graph == updatedGraph )
	    continue;

	var currentXY = graph.xAxisRange();

	if ( currentXY[0] != newXY[0] || currentXY[1] != newXY[1] ) {
	    graph.updateOptions({dateWindow: newXY});
	}

	
    }

}
