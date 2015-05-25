package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"bytes"
	"io/ioutil"
)

/*
#include <data_tile.h>
*/
import "C"

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

func buildRates (downloads []download) ([]byte) {
	/*
	segment := capn.NewBuffer(nil)
	dataTile := schema.NewRootDataTile(segment)
	
	dataTile.SetEncoding( schema.ENCODINGOPTIONS_DISCRETE )
	dataTile.SetAggregation( schema.AGGREGATIONOPTIONS_NONE )
	dataTile.SetEpoc( 1970 )
	dataTile.SetStartTime( 0 )
	dataTile.SetTimeFactor( -3 )
	dataTile.SetDuration( 10 * 60 * 1000 )
	dataTile.SetUnits( "Mbps" )
	dataTile.SetBaseValue( 0 )
	dataTile.SetValueFactor( 0 )

	var lastTime uint64 = 0
	var lastValue int64 = 0

	times := dataTile.Times()
	values := dataTile.Values()

	for i, download := range downloads {
		currentTime := uint64(download.time * 1000)
		times.Set( i, currentTime - lastTime )
		lastTime = currentTime

		currentValue := int64(download.rate * 1000)
		values.Set( i, currentValue - lastValue )
		lastValue = currentValue
	}
        */
	buf := bytes.Buffer{}
	//segment.WriteTo(&buf)

	return buf.Bytes()
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "Usage: build_tile inFile outFile")
		os.Exit(1)
	}

	dataFile := os.Args[1]
	outFile  := os.Args[2]
	downloads, _, _ := parseFile(dataFile)

	ratesTile := buildRates( downloads )
	
	err := ioutil.WriteFile(outFile, ratesTile, 0444)

	if err != nil {
		panic(err)
	}
}
