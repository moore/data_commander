using Go = import "go.capnp";

$Go.package("schema");
$Go.import("planet.com/dc/schema");

@0x915b85f0d1c29cbd;

enum AggregationOptions {
  none   @0;
  mean   @1;
  median @2;
  mode   @3;
  max    @4;
  min    @5;
}

enum EncodingOptions {
  discrete @0; # (value time) tupples with gap encoding.
  bucket   @1; # (value samples) tupples with time jumps for gaps
}

struct DataTile {
  encoding     @0  :EncodingOptions;
  aggregation  @1  :AggregationOptions;
  epoc         @2  :Int64; # in calander years
  startTime    @3  :UInt64; # in epoc ms
  timeFactor   @4  :Int8; 
  duration     @5  :UInt64; # units: 1s * 10^timeFactor
  units        @6  :Text;
  baseValue    @7  :UInt64;
  valueFactor  @8  :Int8;
  values       @9  :List(Int64); # *10^valueFactor
  samples      @10 :List(UInt64);
  varianceType @11 :Text;
  variance1    @12 :List(Int64); # *10^valueFactor
  variance2    @13 :List(Int64); # *10^valueFactor
  times        @14 :List(UInt64); # units: 1s * 10^timeFactor
}
