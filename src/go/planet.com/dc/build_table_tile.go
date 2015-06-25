package main

import (
	//"bufio"
	"fmt"
	"os"
	"strconv"
	"io/ioutil"
	"errors"
	"encoding/csv"
	"sort"
	"math"
)

/*
#include <stdlib.h>
#include <stdint.h>
#include <data_tile.h>
*/
import "C"
import "unsafe"

type Scene struct {
	Satellite string
	Timestamp uint64
	Lat       float64
	Lon       float64
}

type ByTimestamp []Scene

func (a ByTimestamp) Len() int           { return len(a) }
func (a ByTimestamp) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a ByTimestamp) Less(i, j int) bool { return a[i].Timestamp < a[j].Timestamp }

func parseFile ( dataFile string ) ([]Scene, error) {
	csvfile, err := os.Open(dataFile)
	
	if err != nil {
		return nil, err
	}

	defer csvfile.Close()

	reader := csv.NewReader(csvfile)	

	reader.FieldsPerRecord = 0

	rawCSVdata, err := reader.ReadAll()

	if err != nil {
		return nil, err
	}

	scenes := make([]Scene, len(rawCSVdata))

         // sanity check, display to standard output
         for i, each := range rawCSVdata {
		 timestamp, _ := strconv.ParseUint(each[0], 10, 64)
		 satellite    := each[1]
		 lat      , _ := strconv.ParseFloat(each[2], 32)
		 lon      , _ := strconv.ParseFloat(each[3], 32)

		 scenes[i].Timestamp = timestamp * 1000
		 scenes[i].Satellite = satellite
		 scenes[i].Lat       = (float64)(lat)
		 scenes[i].Lon       = (float64)(lon)

         }

	return scenes, nil
}


func writeTiles ( scenes []Scene, prefix string ) ( error )  {
	sort.Sort(ByTimestamp(scenes))

	fmt.Fprintf(os.Stdout, "fround %v scenes covering %vms ( %v - %v )\n", 
		len(scenes),
		scenes[len(scenes)-1].Timestamp - scenes[0].Timestamp,
		scenes[len(scenes)-1].Timestamp, scenes[0].Timestamp)


	var BucketSize uint64 = 24 * 60 * 60 * 1000

	times  := make([]uint64, len(scenes))
	lats   := make([]int64 , len(scenes))
	lons   := make([]int64 , len(scenes))

	var currnetTileTime uint64  = 0
	var cussrntStart    int     = 0
	var lastTime        uint64  = 0
	var lastLat         float64 = 0
	var lastLon         float64 = 0

	for i, record := range scenes {
		tileTime := (record.Timestamp / BucketSize) * BucketSize 
			
		if currnetTileTime == 0 {
			currnetTileTime = tileTime
		} else if currnetTileTime != tileTime {
			tile, _ := makeTile( times[cussrntStart:i], lats[cussrntStart:i], lons[cussrntStart:i], prefix )
			cussrntStart = i

			path := prefix  + ":" + strconv.FormatUint(currnetTileTime, 10) + ".tile"

			writeTile( tile, path )
			lastTime  = 0
			lastLat   = 0
			lastLon   = 0
			currnetTileTime = tileTime
		}

		times[i] = record.Timestamp - lastTime 
		lats[i]  = (int64)((record.Lat - lastLat) * math.Pow(10, 6))
		lons[i]  = (int64)((record.Lon - lastLon) * math.Pow(10, 6))

		lastTime = record.Timestamp
		lastLat  = record.Lat
		lastLon  = record.Lon
	}

	tile, _ := makeTile( times[cussrntStart:], lats[cussrntStart:], lons[cussrntStart:], prefix )
	path := prefix  + ":" + strconv.FormatUint(currnetTileTime, 10) + ".tile"

	writeTile( tile, path )


	return nil
}

func makeTile ( times []uint64, values []int64, variance1 []int64, units string ) ([]byte, error) {

	units_c := C.CString(units)
	defer C.free(unsafe.Pointer(units_c))

	fmt.Fprintf(os.Stdout, "writing tile of %v with %v entries\n", units, len(values) )

	var builder C.struct_DataTile_builder

	builder.prebuilt = false
	builder.encoding = 0
	builder.aggregation = 0
	builder.epoc = 1970
	builder.startTime = 0
	builder.timeFactor = -3
	builder.duration = 24 * 60 * 60 * 1000
	builder.units.data = units_c
	builder.units.length = (C.size_t)(len(units))
	builder.baseValue = 0
	builder.valueFactor = -6
	builder.values.data = (*C.int64_t)(unsafe.Pointer(&values[0]))
	builder.values.count = C.size_t(len(values))
	builder.variance1.data = (*C.int64_t)(unsafe.Pointer(&variance1[0]))
	builder.variance1.count = C.size_t(len(variance1))
	builder.times.data = (*C.uint64_t)(unsafe.Pointer(&times[0]))
	builder.times.count = C.size_t(len(times))
	
	size := C.compute_DataTile_length(&builder);
	result := make([]byte, size);
	buffer := (*C.char)(unsafe.Pointer(&result[0]))

	wrote := C.build_DataTile(buffer, size, &builder)
	
	if wrote == 0 {
		return nil, errors.New("Could not write message.")
	}
	
	return result, nil

}


func writeTile ( data []byte, path string) {
	err := ioutil.WriteFile(path, data, 0644)

	if err != nil {
		panic(err)
	}
}

func main() {
	/*if len(os.Args) < 5 {
		fmt.Fprintln(os.Stderr, "Usage: build_tile inFile outPrefix index-column column1:type <column2:type ... columnN:type>")
		os.Exit(1)
	}*/

	dataFile             := os.Args[1]
	outFileoutFilePrefix := os.Args[2]
	//indexColumn          := os.Args[3]
	//columns              := os.Args[4:]

	data, err := parseFile(dataFile)

	if err != nil {
		panic(err)
	}

	writeTiles( data, outFileoutFilePrefix )
}
