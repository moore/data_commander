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
#include <data_tile.h>
*/
import "C"
import "unsafe"

type Register struct {
	Field         string
	Satellite     string
	Timestamp     uint64
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

		var BucketSize uint64 = 24 * 60 * 60 * 1000

		times  := make([]uint64, len(records))
		values := make([]int64 , len(records))

		var currnetTileTime uint64  = 0
		var cussrntStart    int     = 0
		var lastTime        uint64  = 0
		var lastValue       float64 = 0

		for i, record := range records {
			tileTime := (record.Timestamp / BucketSize) * BucketSize 
			
			if currnetTileTime == 0 {
				currnetTileTime = tileTime
			} else if currnetTileTime != tileTime {
				// BUG: won't dump last result!
				tile, _ := makeTile( times[cussrntStart:], values[cussrntStart:], key )
				cussrntStart = i

				path := prefix + key + ":" + strconv.FormatUint(currnetTileTime, 10) + ".tile"

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

func makeTile ( times []uint64, values []int64, units string ) ([]byte, error) {

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
	builder.valueFactor = -3
	builder.values.data = (*C.int64_t)(unsafe.Pointer(&values[0]))
	builder.values.count = C.size_t(len(values))
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
