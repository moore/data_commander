#include <stdlib.h>
#include <stdint.h>
#include "dc.capnp.h"

typedef struct {
  uint64_t value;
  uint64_t time;
} iterator_t ;

extern "C" {
  int two_times ( int in ) {
    return in * 2;
  }

  iterator_t* initIterator ( ) {
    return (iterator_t*)malloc(sizeof(iterator_t));
  }
  
  bool nextValue (char* message, iterator_t* iterator) {
    return true;
  }

  void finishIterator (iterator_t* iterator) {
    free(iterator);
  }
}
