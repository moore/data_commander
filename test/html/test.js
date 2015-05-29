var start = Date.now();
doFetch( './rates-rx.out'  , plotRates );
doFetch( './missing-rx.out', plotMissing );


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


var graphs = [];

var rateGraph = new Dygraph(document.getElementById("rate-container"),
			[[0,0]],
			options);

graphs.push( rateGraph );

var missingGraph = new Dygraph(document.getElementById("missing-container"),
			[[0,0]],
			options);
graphs.push( missingGraph );


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

function plotRates ( tile ) {

    var data = processTile( tile );


    rateGraph.updateOptions({
	file : data,
	title: 'Data rate per file downloaded.',
	ylabel: 'kbp/s',
	labels: ['date', 'kbp/s'],
    } );

    console.log( "finished plot:", Date.now() - start );
}

function plotMissing ( tile ) {

    var data = processTile( tile );

    missingGraph.updateOptions({
	file : data,
        title: 'Total missing chunks',
	ylabel: 'chunks',
	labels: ['date', 'chunks'],
    } );

    console.log( "finished plot:", Date.now() - start );
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
