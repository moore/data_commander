      
fetch('./rx.out')  
    .then( function(response) {  
	if (response.status !== 200) {  
	    console.log('Looks like there was a problem. Status Code: ' +  
			response.status);  
	    return;  
	}

	response.arrayBuffer()
	    .then(processTile)
	.catch(function(err) {
	    console.log("error getting array buffer:", error);
	});  
    } )  
    .catch(function(err) {  
	console.log('Fetch Error :-S', err);  
    });

function processTile ( tile ) {
    console.log( "got tile: ", tile );
    var buffer = loadBuffer( tile );
    var iterator = initIterator( buffer );
    var result = nextValue( initIterator );
    finishIterator( initIterator );
    freeBuffer( buffer );
    console.log("foo", result );
}
