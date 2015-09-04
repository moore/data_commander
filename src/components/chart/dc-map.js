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

	    
	    window.addEventListener('resize', function () {
		requestAnimationFrame( this.viz.resize );
	    });
	    

	    
	    requestAnimationFrame( this.viz.ready );
	},    
    });


    function loadMap ( root, sources, startDate, endDate ) {

	var typeName = "scene";


	var startTime = startDate.getTime();
	var endTime   = endDate.getTime();


	var fetcher = new DataFetcher ( );

	var viz = Viz( root, fetcher );

	viz.setSelection( 'lon' , -180, 180 );
	viz.setSelection( 'lat' , -90, 90 );
	viz.setSelection( 'time', startTime , endTime );
	viz.setSelection( 'hwid', 0 , 0 );

	var plot1Data = [];
	var plot2Data = [];
	var colors    = [ [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0] ];

	for ( var i = 0 ; i < sources.length ; i++ ) {

	    var sourceKey = viz.addData( sources[i],  typeName, 
					 startTime, endTime, 
					 ['time', 'lon', 'lat', 'hwid', 'good'],
					 {
					     xRange : [-180, 180],
					     yRange : [-90 , 90 ],
					     color  : colors[ i % colors.length ],
					 } );
	    plot1Data.push( sourceKey );
	    
	    plot2Data.push( sourceKey );
	}



	/*
	  viz.addView( Map, "#plot1",  
	  [],
	  {
	  lockZoomXY : true,
	  group : 1,
	  } );
	*/

	viz.addView( ScatterPlot, "#plot1",
		     plot1Data,
		     {
			 lockZoomXY : true,
			 group      : 1,
			 x          : 'lon',
			 y          : 'lat',
		     } );

	
	viz.addView( BarChart, "#plot2",  
		     plot2Data,
		     {
			 group  : 2,
			 column : 'time',
		     } );

	viz.addView( ItemList, "#sat",  
		     plot2Data,
		     {
			 group  : 2,
			 column : 'hwid',
		     } );

	
	return viz;

    }

}
