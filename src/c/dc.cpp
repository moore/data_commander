#include <stdlib.h>
#include <stdint.h>
#include <emscripten.h>
#include "data_tile.h"

typedef struct {
  size_t   count ;
  uint32_t index ;
  int64_t  value;
  uint64_t time;
} iterator_t ;

extern "C" {

  iterator_t* initIterator ( DataTile* messageData ) {

    iterator_t* iterator = (iterator_t*)malloc(sizeof(iterator_t));
    iterator->count = DataTile_count_values( messageData );
    iterator->index = 0;
    iterator->time  = DataTile_read_startTime( messageData );
    iterator->value = DataTile_read_baseValue( messageData );
    
    return iterator;
  }
  
  bool nextValue ( DataTile* messageData, iterator_t* iterator ) {
    
    if ( iterator->index >= iterator->count )
      return false;

    iterator->time = iterator->time
      + DataTile_read_times( messageData, iterator->index );

    iterator->value = iterator->value
      + DataTile_read_values( messageData, iterator->index );
    
    iterator->index++;
    return true;
  }

  int64_t readValue ( iterator_t* iterator ) {
    return iterator->value;
  }

  uint64_t readTime ( iterator_t* iterator ) {
    return iterator->time;
  }

  void finishIterator (iterator_t* iterator) {
    free(iterator);
  }
}
