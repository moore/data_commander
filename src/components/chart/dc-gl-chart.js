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

function loadGraph ( root, sourceName, typeName, startDate, endDate ) {

    var startTime = startDate.getTime();
    var endTime   = endDate.getTime();

    var fetcher = new DataFetcher ( );

    var viz = Viz( root, fetcher );

    var plot1Data = [
	{
	    sourceName : sourceName, 
	    typeName   : typeName  , 
	    indexStart : startTime ,
	    indexEnd   : endTime   ,
	    projection : [0, 1]    ,
	},
	{
	    sourceName : sourceName, 
	    typeName   : "batt voltages set"  , 
	    indexStart : startTime ,
	    indexEnd   : endTime   ,
	    projection : [0, 1]    ,
	}
    ];


    var plot2Data = [
	{
	    sourceName : sourceName, 
	    typeName   : "batt voltages set"  , 
	    indexStart : startTime ,
	    indexEnd   : endTime   ,
	    projection : [0, 1]    ,
	}
    ];

    viz.addView( ScatterPlot, "#plot1",
		 plot1Data,
		 {  } );

    viz.addView( ScatterPlot, "#plot2",  
		 plot2Data,
		 {  } );

    
    return viz;
}




