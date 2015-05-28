package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"io/ioutil"
	"errors"
)

/*
#include <stdlib.h>
#include <stdint.h>
#include <data_tile.h>
*/
import "C"
import "unsafe"

type download struct {
	time float64
	size int64
	delta float64
	rate float64
}

type missingChunks struct {
	time float64
	count int64
}

type queueInfo struct {
	time float64
	entries int64
	length int64
}

func parseFile ( dataFile string ) ([]download, []missingChunks, []queueInfo) {
	data, err := os.Open(dataFile)
	
	if err != nil {
		panic(err)
	}

	downloadMatcher := regexp.MustCompile(`\[\s*(\d+\.\d+).*?Download of (\d+).*?completed in (\d+\.\d+) seconds \((\d+\.\d+)`)
	missingMatcher := regexp.MustCompile(`\[\s*(\d+\.\d+).*?Requesting (\d+) missing chunks`)
	queueMatcher, _ := regexp.Compile(`\[\s*(\d+\.\d+).*?New queue: entries (\d+), length (\d+)`)

	

	scanner := bufio.NewScanner(data)

	var downloads []download
	var missing   []missingChunks
	var queues    []queueInfo
	var minTime   float64
	var found     [][]string
	minTime = 0

	for scanner.Scan() {
		line := scanner.Text()

		found = downloadMatcher.FindAllStringSubmatch( line, 1 )
		if found != nil {
			time , _ := strconv.ParseFloat(found[0][1], 64)
			size , _ := strconv.ParseInt(found[0][2], 10, 64)
			delta, _ := strconv.ParseFloat(found[0][3], 64)
			rate , _ := strconv.ParseFloat(found[0][4], 64)
			result := download{time, size, delta, rate}

			downloads = append( downloads, result )
			if minTime == 0 {
				minTime = time
			}
			continue
		}

		found = missingMatcher.FindAllStringSubmatch( line, 1 )
		if found != nil {
			time , _ := strconv.ParseFloat(found[0][1], 64)
			count , _ := strconv.ParseInt(found[0][2], 10, 64)
			result := missingChunks{time, count}

			missing = append( missing, result )
			if minTime == 0 {
				minTime = time
			}
			continue
		}

		found = queueMatcher.FindAllStringSubmatch( line, 1 )
		if found != nil {
			time    , _ := strconv.ParseFloat(found[0][1], 64)
			entries , _ := strconv.ParseInt(found[0][2], 10, 64)
			length  , _ := strconv.ParseInt(found[0][3], 10, 64)
			result := queueInfo{time, entries, length}

			queues = append( queues, result )
			if minTime == 0 {
				minTime = time
			}
			continue
		}

		
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintln(os.Stderr, "reading standard input:", err)
	}

	return downloads, missing, queues
}

func buildRates (downloads []download) ([]byte, error) {
	
	var lastTime uint64 = 0
	var lastValue int64 = 0

	times  := make([]uint64, len(downloads))
	values := make([]int64 , len(downloads))

	for i, download := range downloads {
		currentTime := uint64(download.time * 1000)
		times[i] = currentTime - lastTime
		lastTime = currentTime

		currentValue := int64(download.rate * 1000)
		values[i] = currentValue - lastValue
		lastValue = currentValue

	}

	units := C.CString("Mbps")
	defer C.free(unsafe.Pointer(units))

	var builder C.struct_DataTile_builder

	builder.prebuilt = false
	builder.encoding = 0
	builder.aggregation = 0
	builder.epoc = 1970
	builder.startTime = 0
	builder.timeFactor = -3
	builder.duration = 10 * 60 * 1000
	builder.units.data = units
	builder.units.length = 5 //BUG should \0 be included or not
	builder.baseValue = 0
	builder.valueFactor = 0
	builder.values.data = (*C.int64_t)(unsafe.Pointer(&values[0]))
	builder.values.count = C.size_t(len(values))
	builder.times.data = (*C.uint64_t)(unsafe.Pointer(&times[0]))
	builder.times.count = C.size_t(len(times))
	builder.varianceType.data = units //BUG
	builder.varianceType.length = 5
	
	size := C.compute_DataTile_length(&builder);
	result := make([]byte, size);
	buffer := (*C.char)(unsafe.Pointer(&result[0]))

	wrote := C.build_DataTile(buffer, size, &builder)
	
	if wrote == 0 {
		return nil, errors.New("Could not write message.")
	}
	
	return result, nil
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "Usage: build_tile inFile outFile")
		os.Exit(1)
	}

	dataFile := os.Args[1]
	outFile  := os.Args[2]
	downloads, _, _ := parseFile(dataFile)

	ratesTile, _ := buildRates( downloads )
	
	err := ioutil.WriteFile(outFile, ratesTile, 0644)

	if err != nil {
		panic(err)
	}
}
