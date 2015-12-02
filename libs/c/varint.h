#ifndef VARINT_IMPLMENTATION_H
#define VARINT_IMPLMENTATION_H

#if defined(__linux__)
#  include <endian.h>
#elif defined(__FreeBSD__) || defined(__NetBSD__)
#  include <sys/endian.h>
#elif defined(__OpenBSD__)
#  include <sys/types.h>
#  define be16toh(x) betoh16(x)
#  define be32toh(x) betoh32(x)
#  define be64toh(x) betoh64(x)
#else
# include <endian.h>
#endif


#include <stdint.h>
#include <stdbool.h>

#define ONES 0xffffffffffffffff

typedef struct varIntVec_t_ {} varIntVec_t;


/*
  Encoding for int64_t:
    bytes used  : count of leading 0's + 1
    is negitive : "first bit set" + 1 is 1
*/

size_t encodeInt64 ( int64_t value, uint8_t *buffer, 
		     off_t buffer_offset, size_t buffer_lenght ) {

  uint64_t big_endian = htobe64( value );
  uint8_t *write_ptr  = buffer + buffer_offset;
  uint8_t leading     = __builtin_clzll( value );

 // Negitive number
  if ( leading == 0 )
    leading = __builtin_clzll( value^ONES );

  uint8_t length       = 8 - leading/8;
  uint8_t byte_leading = (leading % 8);

  // Need more space for count flag
  if ( byte_leading < (length+1) )
    length++;
  
  // Corner case
  if ( length == 8 && byte_leading == 0 )
    length++;

  // Not enought space.
  if ( buffer_lenght - buffer_offset < length )
    return 0;

  // Simple case
  if ( length == 9 ) {
    *write_ptr = 0;

    memcpy( (void*)(write_ptr + 1), 
	    (void*)&big_endian, 
	    8 );
  }

  // Normal case
  else {
    uint8_t first_byte = 8 - length;

    memcpy( (void*)write_ptr, 
	    (void*)(((uint8_t*)&big_endian)+first_byte), 
	    (size_t)length );

    // Clear bits
    *write_ptr &= 255>>length;
    // Set length flag
    *write_ptr ^= 128>>(length-1);
  }

  return length;
}


size_t decodeInt64 ( int64_t *value, uint8_t *buffer, off_t buffer_offset, size_t buffer_lenght ) {

  uint8_t *data_ptr = buffer + buffer_offset;
  uint8_t length;

  if ( *data_ptr == 0 ) {
    // Not enought data
    if ( buffer_lenght - buffer_offset < 9 )
      return 0;

    memcpy( (void*)value, data_ptr +1 , 8 );

    length = 9;
  }

  else {

    uint8_t leading = __builtin_clz( *data_ptr ) - 24;
    length = leading + 1;

    uint8_t test_byte = *data_ptr;

    if ( leading == 7 )
      test_byte = *(data_ptr+1);

    uint8_t pos_mask = 0x80>>(length%8);
    bool is_positive =  (test_byte&pos_mask) == 0;

    if ( is_positive == true )
      *value = 0;
  
    else 
      *value = -1;

    uint8_t *write_ptr = (uint8_t*)value + 8 - length;

    memcpy( (void*)write_ptr, data_ptr, length ); 
  
    if ( is_positive == true ) {
      uint8_t mask = 1<<(8-length);
      *write_ptr = (*write_ptr)^mask;
    }
  
    else {
      uint8_t mask = 255<<(8-leading);
      *write_ptr = (*write_ptr)|mask;
    }
  }

  *value = be64toh( *value );
  
  return length;
}

int64_t read_varInt64_vector_count ( varIntVec_t *buffer, 
			      off_t buffer_offset, size_t buffer_lenght ) {
  int64_t count;
  size_t  read = decodeInt64( &count, (uint8_t*)buffer, 
			      buffer_offset, buffer_lenght );
  if ( read == 0 )
    return -1;

  if ( count != (uint32_t)count )
    return -2;

  return count;
}

typedef struct {
  uint32_t count;
  uint32_t visited;
  off_t    current_offset;
  uint8_t *buffer;
  off_t    buffer_offset;
  size_t   buffer_lenght;
} varInt64_iterator_t; 

int init_varInt64_iterator ( varInt64_iterator_t *iterator,
			      varIntVec_t *buffer, 
			      off_t buffer_offset, size_t buffer_lenght ) {
  int64_t count;
  size_t  read = decodeInt64( &count, (uint8_t*)buffer, 
			      buffer_offset, buffer_lenght );
  if ( read == 0 )
    return -1;

  if ( count != (uint32_t)count )
    return -2;

  iterator->count          = (uint32_t)count;
  iterator->visited        = 0;
  iterator->current_offset = buffer_offset + read;
  iterator->buffer         = (uint8_t*)buffer;
  iterator->buffer_offset  = buffer_offset;
  iterator->buffer_lenght  = buffer_lenght;

  return 0;
}

#define ITERATOR_ERROR -1
#define ITERATOR_MORE   0
#define ITERATOR_DONE   1

int varInt64_get_next ( varInt64_iterator_t *iterator, int64_t *result ) {
  if ( iterator->visited == iterator->count )
    return ITERATOR_DONE;

  size_t read = decodeInt64( result, iterator->buffer, 
			     iterator->current_offset,
			     iterator->buffer_lenght );			    
  if ( read == 0 )
    return ITERATOR_ERROR;

  else {
    iterator->current_offset += read;
    iterator->visited++;
  }

  return ITERATOR_MORE;
}

typedef struct {
  uint32_t count;
  size_t   worte;
} write_varint64_vector_result;

write_varint64_vector_result
write_varint64_vector ( int64_t *data, uint32_t count, varIntVec_t *buffer,
			    off_t buffer_offset, size_t buffer_lenght ) {
  uint32_t i = 0;
  off_t    current_offset = buffer_offset;

  size_t wrote = encodeInt64( (int64_t)count, (uint8_t*)buffer,
				current_offset, buffer_lenght );

  if ( wrote != 0 ) {
    current_offset += wrote;


    for ( i = 0 ; i < count ; i++ ) {
      wrote = encodeInt64( data[i], (uint8_t*)buffer,
				  current_offset, buffer_lenght );
      if ( wrote == 0 )
	break;

      current_offset += wrote;
    }
  }

  return (write_varint64_vector_result)
    { i, (size_t)current_offset - buffer_offset };
}


size_t
compute_varint64_vector_length ( int64_t *data, uint32_t count ) {
  uint32_t i = 0;
  size_t   length = 0;
  uint8_t  buffer[9];

  length += encodeInt64( (int64_t)count, buffer,
			      0, sizeof(buffer));

  for ( i = 0 ; i < count ; i++ ) {
    length +=encodeInt64( data[i], (uint8_t*)buffer,
				  0, sizeof(buffer) );
  }

  return length;
}
#endif /* VARINT_IMPLMENTATION_H  */
