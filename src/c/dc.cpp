#include <stdlib.h>
#include <stdint.h>
#include <emscripten.h>
#include "data_tile.h"

typedef struct {
  uint64_t value;
  uint64_t time;
} iterator_t ;

extern "C" {

  iterator_t* initIterator ( DataTile* messageData ) {
    
    iterator_t* iterator = (iterator_t*)malloc(sizeof(iterator_t));
    iterator->time = DataTile_read_startTime( messageData );
    iterator->value = DataTile_read_baseValue( messageData );

    return iterator;
  }
  
  bool nextValue (char* messageData, iterator_t* iterator) {
    uint64_t time = iterator->time;
    
    return time == 0 ? true : false;
  }

  void finishIterator (iterator_t* iterator) {
    free(iterator);
  }
}
