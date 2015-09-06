"use strict";

var Range = new function () {
    return factory;

    function factory ( ) {
	var fMin = 0;
	var fMax = 0;
	
	if ( arguments.length === 1 ) {
	    var parts = arguments[0].split(':');
	    fMin = new Number ( parts[0] );
	    fMax = new Number ( parts[1] );
	}

	else if ( arguments.length >= 2 ) {
	    fMin = new Number ( arguments[0] );
	    fMax = new Number ( arguments[1] );
	}

	return constructor( fMin, fMax );
    }

    function constructor ( fMin, fMax ) {
	var self = {};

	self.getMin   = getMin;
	self.getMax   = getMax;
	self.setRange = setRange;

	return self;

	function getMin ( ) {
	    return fMin;
	}

	function getMax ( ) {
	    return fMax;
	}

	function setRange ( newMin, newMax ) {
	    fMin = newMin;
	    fMax = newMax;
	}
    }
};

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
	    lat: {
		type :  Range,
		value: new Range ( -90, 90 ),
	    },
	    lon: {
		type :  Range,
		value: new Range ( -180, 180 ),
	    },
	    hwid: {
		type : Number,
		value: 0,
	    },
	},
	// add a callback to the element's prototype
	ready: function() {
	    var viz = loadMap( this );
	    this.viz = viz

	    
	    window.addEventListener('resize', function () {
		requestAnimationFrame( viz.resize );
	    });
	    

	    
	    requestAnimationFrame( viz.ready );
	},    
    });


    function loadMap ( root ) {

	var typeName = "scene";

	var sources = root.source
	    .split(',')
	    .map(function (s) { return s.trim() })
	;

	var startTime = root.start.getTime();
	var endTime   = root.end.getTime();

	var fetcher = new DataFetcher ( );

	var viz = Viz( root, fetcher );

	viz.setSelection( 'time',
			  startTime, 
			  endTime );

	viz.setSelection( 'lon', 
			  root.lon.getMin(),
			  root.lon.getMax() );

	viz.setSelection( 'lat',
			  root.lat.getMin(),
			  root.lat.getMax() );

	viz.setSelection( 'hwid',
			  root.hwid,
			  root.hwid );

	
	viz.addSelectionListner( selectionChanged );

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

    function selectionChanged ( keys ) {
	
    }

}
