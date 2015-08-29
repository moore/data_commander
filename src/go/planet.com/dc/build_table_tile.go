package main

import (
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
	Satellite uint16
	Timestamp uint64
	Lat       float64
	Lon       float64
	Good      uint8
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
		if i == 0 { // Header
			continue
		}

		timestamp, _ := strconv.ParseUint(each[0], 10, 64)
		satellite, _ := strconv.ParseUint(each[1], 16, 16)
		lat      , _ := strconv.ParseFloat(each[2], 32)
		lon      , _ := strconv.ParseFloat(each[3], 32)
		good     , _ := strconv.ParseUint(each[4], 10, 8)

		index := i-1;
		scenes[index].Timestamp = timestamp * 1000
		scenes[index].Satellite = uint16(satellite)
		scenes[index].Lat       = (float64)(lat)
		scenes[index].Lon       = (float64)(lon)
		scenes[index].Good      = uint8(good)

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

	times  := make([]int64, len(scenes))
	sats   := make([]int64, len(scenes))
	lats   := make([]int64, len(scenes))
	lons   := make([]int64, len(scenes))
	good   := make([]int64, len(scenes))

	var currnetTileTime uint64  = 0
	var cussrntStart    int     = 0
	var lastTime        int64   = 0
	var lastSat         int64   = 0
	var lastLat         float64 = 0
	var lastLon         float64 = 0
	var lastGood        int64   = 0

	for i, record := range scenes {
		tileTime := (record.Timestamp / BucketSize) * BucketSize 
			
		if currnetTileTime == 0 {
			currnetTileTime = tileTime
		} else if currnetTileTime != tileTime {
			tile, _ := makeTile( times[cussrntStart:i], sats[cussrntStart:i], lats[cussrntStart:i], lons[cussrntStart:i], good[cussrntStart:i] )
			cussrntStart = i

			path := prefix  + ":" + strconv.FormatUint(currnetTileTime, 10) + ".tile"

			writeTile( tile, path )
			lastTime  = 0
			lastLat   = 0
			lastLon   = 0
			lastSat   = 0
			lastGood  = 0
			currnetTileTime = tileTime
		}

		times[i] = int64(record.Timestamp) - lastTime 
		sats[i]  = int64(record.Satellite) - lastSat
		lats[i]  = (int64)((record.Lat - lastLat) * math.Pow(10, 6))
		lons[i]  = (int64)((record.Lon - lastLon) * math.Pow(10, 6))
		good[i]  = int64(record.Good) - lastGood

		lastTime = int64(record.Timestamp)
		lastSat  = int64(record.Satellite)
		lastLat  = record.Lat
		lastLon  = record.Lon
		lastGood = int64(record.Good)
	}

	tile, _ := makeTile( times[cussrntStart:], sats[cussrntStart:], lats[cussrntStart:], lons[cussrntStart:], good[cussrntStart:] )
	path := prefix  + ":" + strconv.FormatUint(currnetTileTime, 10) + ".tile"

	writeTile( tile, path )


	return nil
}

func buildColumn ( name string, units string, values []int64, valueFactor int8) (C.struct_Column_builder) {
	var builder C.struct_Column_builder

	// BUG: these should just be passed in as well as basevalue
	var min int64
	var max int64

	if len(values) > 0 {
		min = values[0]
		max = values[0]
	} else {
		min = 0
		max = 0
	}

	for _, value := range values {
		if value > max {
			max = value
		}

		if value < min {
			min = value
		}
	}

	builder.prebuilt = false

	builder.name.data    = C.CString(name)
	builder.name.length  = C.size_t(len(name))
	builder.units.data   = C.CString(units)
	builder.units.length = C.size_t(len(units))
	builder.baseValue    = 0
	builder.valueFactor  = C.int8_t(valueFactor)
	builder.min          = C.int64_t(min)
	builder.max          = C.int64_t(max)
	builder.values.data  = (*C.int64_t)(unsafe.Pointer(&values[0]))
	builder.values.count = C.size_t(len(values))

	return builder
}

func freeColumn ( builder C.struct_Column_builder) () {
	C.free(unsafe.Pointer(builder.name.data))
	C.free(unsafe.Pointer(builder.units.data))
}

func makeTile ( times []int64, sats []int64, lats []int64, lons []int64, good []int64 ) ([]byte, error) {

	tableType   := "tychoon"
	tableType_c := C.CString(tableType)
	defer C.free(unsafe.Pointer(tableType_c))

	fmt.Fprintf(os.Stdout, "writing tile of with %v entries\n", len(times) )

	timeColumn := buildColumn( "time", "s", times, -3 )
	defer freeColumn( timeColumn )

	hwidColumn := buildColumn( "hwid", "id", sats, 0 )
	defer freeColumn( hwidColumn )

	latColumn := buildColumn( "lat", "deg", lats, -6 )
	defer freeColumn( latColumn )

	lonColumn := buildColumn( "lon", "deg", lons, -6 )
	defer freeColumn( lonColumn )

	goodColumn := buildColumn( "good", "good", good, 0 )
	defer freeColumn( goodColumn )

	secondaryColumns := 
		[]*C.struct_Column_builder{ 
		&hwidColumn, &latColumn, 
		&lonColumn, &goodColumn }

	var builder C.struct_TableTile_builder

	builder.prebuilt = false

	builder.tableType.data = tableType_c
	builder.tableType.length = (C.size_t)(len(tableType))
	builder.indexColumn    = &timeColumn
	// BUG: is this cast even right?
	builder.columns.data   = (**C.struct_Column_builder)(unsafe.Pointer(&secondaryColumns[0]))
	builder.columns.count  = C.size_t(len(secondaryColumns))

	size := C.compute_TableTile_length(&builder);
	result := make([]byte, size);
	buffer := (*C.char)(unsafe.Pointer(&result[0]))

	wrote := C.build_TableTile(buffer, size, &builder)

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
	if len(os.Args) < 4 {
		fmt.Fprintln(os.Stderr, "Usage: build_tile indexColumn outPrefix inFile ")
		os.Exit(1)
	}

	outFileoutFilePrefix := os.Args[2]

	for i := 3; i < len(os.Args) ; i++ {

		dataFile := os.Args[i]

		fmt.Fprintf(os.Stdout, "processing %v:\n", dataFile )

		data, err := parseFile(dataFile)
		
		if err != nil {
			panic(err)
		}

		writeTiles( data, outFileoutFilePrefix )
	}
}
