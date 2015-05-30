var start = Date.now();


var BucketSize = 24 * 60 * 60 * 1000;
var startTime = 1412121600000;
var endTime   = startTime + BucketSize;

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
    var tileStart = snapBound( start, BucketSize );
    
    doFetch( makePath( source, valueType, tileStart ), handler );
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

    var graph = new Dygraph(document.getElementById(nodeId),
			    [[0,0]],
			    options);

    graph.updateOptions({
	dateWindow : [startTime, endTime],
	title      : source + " " + '"' + valueType + '"',
	ylabel     : valueType,
	labels     : ['date', valueType],
    });

    graphs.push( graph );

    getData( source, valueType, startTime, endTime, handleData );

    return graph;

    function handleData ( tile ) {

	var data = processTile( tile );

	graph.updateOptions({
	    file : data,
	} );
    }
}




function doFetch ( file, handler ) {
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

    console.log( "finished download:", Date.now() - start );
    console.log( "tile range %s to %s", new Date(data[0][0]), new Date(data[data.length -1][0]) );
    return data;
}


function handleDraw ( updatedGraph ) {
    var newXY = updatedGraph.xAxisRange();

    for ( var i = 0 ; i < graphs.length ; i++ ) {
	var graph = graphs[ i ];
	if ( graph == updatedGraph )
	    continue;

	var currentXY = graph.xAxisRange();

	if ( currentXY[0] != newXY[0] || currentXY[1] != newXY[1] ) {
	    graph.updateOptions({dateWindow: newXY});
	}

	
    }

}
