#include <stdlib.h>
#include <stdint.h>
#include <math.h>
#include <emscripten.h>
#include "data_tile.h"

typedef struct {
  size_t   count ;
  uint32_t index ;
  double   value;
  double   time;
  double   value_factor;
  double   time_factor;
} iterator_t ;

extern "C" {

  double readStartTime ( DataTile* messageData ) {
    // BUG: start time is not the real start time in current tiles!
    return 
      pow(10, DataTile_read_valueFactor( messageData )) 
      * (double)(DataTile_read_times( messageData, 0 ));

    //return DataTile_read_startTime( messageData );
  }

  iterator_t* initIterator ( DataTile* messageData ) {

    iterator_t* iterator = (iterator_t*)malloc(sizeof(iterator_t));
    iterator->count = DataTile_count_values( messageData );
    iterator->index = 0;
    iterator->time  = DataTile_read_startTime( messageData );
    iterator->value = DataTile_read_baseValue( messageData );

    iterator->value_factor = pow(10,
      DataTile_read_valueFactor( messageData ));

    // Adjust by 3 to prouce Ms when used
    iterator->time_factor  = pow(10,
      DataTile_read_timeFactor( messageData ) + 3);

    return iterator;
  }
  
  bool nextValue ( DataTile* messageData, iterator_t* iterator ) {
    
    if ( iterator->index >= iterator->count )
      return false;

    iterator->time = iterator->time_factor * (double)(iterator->time
		      + DataTile_read_times( messageData, iterator->index ));

    iterator->value = iterator->value_factor * (double)(iterator->value
		       + DataTile_read_values( messageData, iterator->index ));
    
    iterator->index++;
    return true;
  }

  double readValue ( iterator_t* iterator ) {
    return iterator->value;
  }

  double readTime ( iterator_t* iterator ) {
    return iterator->time;
  }

  void finishIterator (iterator_t* iterator) {
    free(iterator);
  }
}
