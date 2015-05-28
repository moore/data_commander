var start = Date.now();
doFetch( './rx.out', processTile );
doFetch( './rx1.out', processTile );
doFetch( './rx2.out', processTile );
doFetch( './rx3.out', processTile );
doFetch( './rx4.out', processTile );
doFetch( './rx5.out', processTile );
doFetch( './rx6.out', processTile );
doFetch( './rx7.out', processTile );
doFetch( './rx8.out', processTile );
doFetch( './rx9.out', processTile );
doFetch( './rx10.out', processTile );

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

    console.log ( "tile lenght %s buffer ptr %s", tile.byteLength, buffer );

    var record = { time : undefined, value : undefined };

    var smallest = 0;
    while ( nextValue( iterator, buffer, record ) ) {
	if ( record.value < smallest )
	    smallest = record.value;
    }

    console.log( 'smallest is ', smallest );

    finishIterator( iterator );
    freeBuffer( buffer );

    console.log( "finished download:", Date.now() - start );

}
