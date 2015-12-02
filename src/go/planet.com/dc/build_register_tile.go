package main

import (
	//"bufio"
	"fmt"
	"os"
	"strconv"
	"io/ioutil"
	"errors"
	"encoding/json"
	"sort"
)

/*
#include <stdlib.h>
#include <stdint.h>
#include "data_tile.h"
*/
import "C"
import "unsafe"

type Register struct {
	Field         string
	Satellite     string
	Timestamp     int64
	Source_name   string
	Command_label string
	Source        string
	Value         float64
}

type ByTimestamp []Register

func (a ByTimestamp) Len() int           { return len(a) }
func (a ByTimestamp) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a ByTimestamp) Less(i, j int) bool { return a[i].Timestamp < a[j].Timestamp }

func parseFile ( dataFile string ) ([]Register, error) {
	data, err := ioutil.ReadFile(dataFile)
	
	if err != nil {
		return nil, err
	}

	var registers []Register
	
	err = json.Unmarshal(data, &registers)

	if err != nil {
		return nil, err
	}
	
	return registers, err
}

func writeTiles ( registers []Register, prefix string ) ( error )  {
	sort.Sort(ByTimestamp(registers))

	fmt.Fprintf(os.Stdout, "fround %v registers covering %vms ( %v - %v )\n", len(registers),
		registers[len(registers)-1].Timestamp - registers[0].Timestamp,
		registers[len(registers)-1].Timestamp, registers[0].Timestamp)

	results := make(map[string][]Register) 

	for _, record := range registers {
		key := record.Satellite + ":"+ record.Field + ":" + record.Command_label
		recordArray, ok := results[key]
		
		if ok == false {
			recordArray = make([]Register, 0)
			results[key] = recordArray
		}

		results[key] = append(recordArray, record)
	}

	for key, records := range results {

		var BucketSize int64 = 24 * 60 * 60 * 1000

		times  := make([]int64, len(records))
		values := make([]int64, len(records))

		var currnetTileTime int64   = 0
		var cussrntStart    int     = 0
		var lastTime        int64   = 0
		var lastValue       float64 = 0

		for i, record := range records {
			tileTime := (record.Timestamp / BucketSize) * BucketSize 
			
			if currnetTileTime == 0 {
				currnetTileTime = tileTime
			} else if currnetTileTime != tileTime {
				// BUG: won't dump last result!
				tile, _ := makeTile( times[cussrntStart:i], values[cussrntStart:i], key )
				cussrntStart = i

				path := prefix + key + ":" + strconv.FormatInt(currnetTileTime, 10) + ".tile"

				writeTile( tile, path )
				lastValue = 0
				lastTime  = 0
				currnetTileTime = tileTime
			}

			times[i]  = record.Timestamp - lastTime 
			values[i] = (int64)((record.Value - lastValue) * 1000) 
			lastTime  = record.Timestamp
			lastValue = record.Value
		}
	}

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

func makeTile ( times []int64, values []int64, units string ) ([]byte, error) {

	tableType   := "register"
	tableType_c := C.CString(tableType)
	defer C.free(unsafe.Pointer(tableType_c))

	fmt.Fprintf(os.Stdout, "writing tile of with %v entries\n", len(times) )

	timeColumn := buildColumn( "time", "ms", times, 0 )
	defer freeColumn( timeColumn )

	valueColumn := buildColumn( "value", units, values, -3 )
	defer freeColumn( valueColumn )

	secondaryColumns := []*C.struct_Column_builder{ &valueColumn }

	var builder C.struct_TableTile_builder

	builder.prebuilt = false

	builder.tableType.data   = tableType_c
	builder.tableType.length = (C.size_t)(len(tableType))
	builder.indexColumn      = &timeColumn
	builder.columns.data     = 
		(**C.struct_Column_builder)(unsafe.Pointer(&secondaryColumns[0]))
	builder.columns.count    = C.size_t(len(secondaryColumns))

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
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "Usage: build_tile inFile outFilePrefix")
		os.Exit(1)
	}

	dataFile             := os.Args[1]
	outFileoutFilePrefix := os.Args[2]

	data, err := parseFile(dataFile)

	if err != nil {
		panic(err)
	}

	writeTiles( data, outFileoutFilePrefix )
}
