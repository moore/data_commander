
#ifndef MESSAGE_IMPLMENTATION_H
#define MESSAGE_IMPLMENTATION_H

#include <stdint.h>
#include <string.h>
#include <stdbool.h>

//BOOG
#include <stdio.h>

#include "varint.h"

// BUG: check these numbers
#define CRYPT_KEYBYTES 32
#define CRYPT_NONCEBYTES 24
#define TYPE_TAG_SIZE 8

#define loadValue( target, source, offset )\
  memcpy( (void*)&target, ((char*)source) + offset, sizeof( target ) );

typedef uint32_t repeated_offset_t ;
typedef uint32_t repeated_count_t ;

struct TaggedField_builder {
    bool        prebuilt ;
    const char* prebuilt_data ;
    size_t      prebuilt_length ;
    uint64_t    tag ;
    const char* data ;
} ;

struct crypt_data_t {
    unsigned char key[CRYPT_KEYBYTES] ;
    unsigned char nonce[CRYPT_NONCEBYTES] ;
} ;

static inline size_t build_TaggedField ( char* data, size_t length, struct TaggedField_builder* builder_data ) ;

size_t static inline compute_TaggedField_length ( struct TaggedField_builder* builder ) ;

typedef struct TableTile_ {} TableTile ;
static const uint64_t TableTile_tag = 0x58df377554a76f9b ;
typedef struct Column_ {} Column ;
static const uint64_t Column_tag = 0x941e36daa222f129 ;
typedef struct DataTile_ {} DataTile ;
static const uint64_t DataTile_tag = 0xb5d908ab36ecbbbe ;

/******* Builder structs *******/

struct TableTile_builder ;
struct Column_builder ;
struct DataTile_builder ;

struct TableTile_builder {
    bool prebuilt ;
    TableTile* prebuilt_data ;

    struct TableTile_type_tableType {
        char* data ;
        size_t length ;
    } tableType ;

    struct Column_builder* indexColumn ;
    struct {
        struct Column_builder** data ;
        size_t count ;
    }  columns ;

} ;

struct Column_builder {
    bool prebuilt ;
    Column* prebuilt_data ;

    int64_t baseValue ;
    int8_t valueFactor ;
    int64_t max ;
    int64_t min ;

    struct Column_type_name {
        char* data ;
        size_t length ;
    } name ;
    struct Column_type_units {
        char* data ;
        size_t length ;
    } units ;
    struct Column_type_values {
        int64_t *data ;
        size_t count ;
    } values ;

} ;

struct DataTile_builder {
    bool prebuilt ;
    DataTile* prebuilt_data ;

    uint8_t encoding ;
    uint8_t aggregation ;
    int64_t epoc ;
    uint64_t startTime ;
    int8_t timeFactor ;
    uint64_t duration ;
    int64_t baseValue ;
    int8_t valueFactor ;

    struct DataTile_type_units {
        char* data ;
        size_t length ;
    } units ;
    struct {
        int64_t *data ;
        size_t count ;
    }  values ;
    struct {
        uint64_t *data ;
        size_t count ;
    }  samples ;
    struct DataTile_type_varianceType {
        char* data ;
        size_t length ;
    } varianceType ;
    struct {
        int64_t *data ;
        size_t count ;
    }  variance1 ;
    struct {
        int64_t *data ;
        size_t count ;
    }  variance2 ;
    struct {
        uint64_t *data ;
        size_t count ;
    }  times ;

} ;

/****** Compute and builder forward delcrations *****/

static inline size_t build_TableTile ( char* data, size_t length, struct TableTile_builder* builder_data ) ;

size_t static inline compute_TableTile_length ( struct TableTile_builder* builder ) ;

size_t static inline TableTile_length ( TableTile* data ) ;

static inline size_t build_Column ( char* data, size_t length, struct Column_builder* builder_data ) ;

size_t static inline compute_Column_length ( struct Column_builder* builder ) ;

size_t static inline Column_length ( Column* data ) ;

static inline size_t build_DataTile ( char* data, size_t length, struct DataTile_builder* builder_data ) ;

size_t static inline compute_DataTile_length ( struct DataTile_builder* builder ) ;

size_t static inline DataTile_length ( DataTile* data ) ;

/** type TableTile **/

static inline TableTile* TableTile_safe_cast ( const char* data, size_t max_length ) {
    if ( max_length < 4 )
        return NULL;

    size_t read_length = TableTile_length( (TableTile*)data ) ;

    if ( read_length > max_length )
        return NULL;

    return (TableTile*)data ;
}

size_t static inline TableTile_length ( TableTile* data ) {
    return (size_t)((uint32_t*)data)[ 0 ] ;
}

size_t static inline compute_TableTile_length ( struct TableTile_builder* builder ) {
    if ( builder == NULL )
        return 0 ;

    if ( builder->prebuilt == true ) {
        if ( builder->prebuilt_data == NULL )
            return 0 ;
        else
            return TableTile_length( builder->prebuilt_data ) ;
    }

    size_t length = 12 ;
    length += builder->tableType.length ;

    if ( builder->indexColumn != NULL ) length += compute_Column_length( builder->indexColumn ) ;

    length += sizeof( repeated_count_t ) ;

    if ( builder->columns.data != NULL ) {
        if (builder->columns.count > 1)
            length += sizeof(repeated_offset_t) * ( builder->columns.count - 1 ) ;

        size_t count = builder->columns.count ;

        for ( size_t i = 0 ; i < count ; i++ ) {
            if ( builder->columns.data[i] != NULL )
                length += compute_Column_length( builder->columns.data[i] ) ;
        }
    }

    return length;
}

///// Field accessors /////

static inline uint32_t TableTile_raw_start_tableType ( TableTile* data ) {
    return 12;
}

static inline uint32_t TableTile_raw_end_tableType ( TableTile* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline const char* TableTile_read_raw_tableType ( TableTile* data ) {
    size_t message_length = TableTile_length( data ) ;
    uint32_t start_offset = TableTile_raw_start_tableType( data ) ;
    uint32_t end_offset   = TableTile_raw_end_tableType( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t TableTile_length_raw_tableType ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_tableType( data ) ;
    uint32_t end_offset   = TableTile_raw_end_tableType( data ) ;
    return end_offset - start_offset ;
}

static inline char* TableTile_read_tableType ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_tableType( data ) ;
    char* result;
    result = (char*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t TableTile_length_tableType ( TableTile* data ) {
    return TableTile_length_raw_tableType( data ) ;
}

static inline size_t TableTile_end_tableType ( TableTile* data ) {
    uint32_t end_offset = TableTile_raw_end_tableType( data ) ;
    return end_offset ;
}

static inline uint32_t TableTile_raw_start_indexColumn ( TableTile* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline uint32_t TableTile_raw_end_indexColumn ( TableTile* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline const char* TableTile_read_raw_indexColumn ( TableTile* data ) {
    size_t message_length = TableTile_length( data ) ;
    uint32_t start_offset = TableTile_raw_start_indexColumn( data ) ;
    uint32_t end_offset   = TableTile_raw_end_indexColumn( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t TableTile_length_raw_indexColumn ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_indexColumn( data ) ;
    uint32_t end_offset   = TableTile_raw_end_indexColumn( data ) ;
    return end_offset - start_offset ;
}

static inline Column* TableTile_read_indexColumn ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_indexColumn( data ) ;
    Column* result;
    result = (Column*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t TableTile_length_indexColumn ( TableTile* data ) {
    return TableTile_length_raw_indexColumn( data ) ;
}

static inline size_t TableTile_end_indexColumn ( TableTile* data ) {
    uint32_t end_offset = TableTile_raw_end_indexColumn( data ) ;
    return end_offset ;
}

static inline uint32_t TableTile_raw_start_columns ( TableTile* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline uint32_t TableTile_raw_end_columns ( TableTile* data ) {
    uint32_t result;
    loadValue( result, data, 0 );
    return result;
}

static inline const char* TableTile_read_raw_columns ( TableTile* data ) {
    size_t message_length = TableTile_length( data ) ;
    uint32_t start_offset = TableTile_raw_start_columns( data ) ;
    uint32_t end_offset   = TableTile_raw_end_columns( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t TableTile_length_raw_columns ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_columns( data ) ;
    uint32_t end_offset   = TableTile_raw_end_columns( data ) ;
    return end_offset - start_offset ;
}

static inline size_t TableTile_start_columns ( TableTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = TableTile_length( data ) ;
    uint32_t start_offset   = TableTile_raw_start_columns( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( index == 0 && start_offset + sizeof( repeated_count_t ) > message_length )
        return 0 ;
    else if ( index != 0 && ( start_offset + sizeof( repeated_count_t )
                              + ( ( index - 1 ) * sizeof( repeated_offset_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof( repeated_offset_t ) * ( count - 1 ) ) ;
    else {
        loadValue( result, data,
                   start_offset
                   + sizeof( repeated_count_t )
                   + (index - 1)*sizeof(repeated_offset_t) );
        result += start_offset;
    }

    return (size_t)result ;
}

static inline size_t TableTile_end_columns ( TableTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = TableTile_raw_start_columns( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = TableTile_raw_end_columns( data ) ;
    else
        result = TableTile_start_columns( data, index + 1 ) ;

    return result ;
}

static inline uint32_t TableTile_count_columns ( TableTile* data ) {
    uint32_t start_offset = TableTile_raw_start_columns( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline Column* TableTile_read_columns ( TableTile* data, uint32_t index ) {
    size_t message_length = TableTile_length( data ) ;
    size_t field_end      = TableTile_end_columns( data, index ) ;
    size_t field_start    = TableTile_start_columns( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (Column*)0 ;

    Column* result;
    result = (Column*)( ((const char*)data) + field_start ) ;
    return result;
}

static inline size_t TableTile_length_columns ( TableTile* data, uint32_t index ) {
    size_t field_end   = TableTile_end_columns( data, index ) ;
    size_t field_start = TableTile_start_columns( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

//// Builder ////

static inline size_t build_TableTile ( char* data, size_t length, struct TableTile_builder* builder_data ) {
    size_t wrote = 0 ;

    if ( builder_data == NULL )
        return 0 ;

    if ( length < 12 )
        return 0 ;

    size_t current_offset = 12 ;

    if ( builder_data->prebuilt == true ) {
        if ( builder_data->prebuilt_data == NULL )
            return 0 ;
        else {
            size_t prebuilt_length = TableTile_length( builder_data->prebuilt_data ) ;

            if ( length < prebuilt_length )
                return 0 ;
            else {
                memcpy( data, (const char*)builder_data->prebuilt_data, prebuilt_length ) ;
                return prebuilt_length ;
            }
        }
    }

    if ( length < current_offset + builder_data->tableType.length )
        return 0 ;

    memcpy( data + current_offset, (const char*)builder_data->tableType.data, builder_data->tableType.length ) ;
    current_offset += builder_data->tableType.length ;
    (*(uint32_t*)(data + 8)) = current_offset ;

    if ( builder_data->indexColumn == NULL )
        wrote = 0 ;
    else {
        wrote = build_Column( data + current_offset,  length - current_offset, builder_data->indexColumn ) ;

        if ( wrote == 0 )
            return 0 ;
    }

    current_offset += wrote ;
    (*(uint32_t*)(data + 4)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->columns.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);
    size_t field_start = current_offset - sizeof(repeated_count_t) ;
    size_t index_offset = current_offset ;

    if (builder_data->columns.count > 1)
        current_offset += sizeof(repeated_offset_t) * (builder_data->columns.count - 1) ;

    for ( size_t i = 0 ; i < builder_data->columns.count ; i++ ) {
        if ( builder_data->columns.data[i] != NULL ) {
            wrote = build_Column( data + current_offset,  length - current_offset, builder_data->columns.data[i] ) ;

            if ( wrote == 0 )
                return 0 ;

            if ( i > 0 ) {
                *(repeated_offset_t*)(data + index_offset) = current_offset - field_start ;
                index_offset += sizeof(repeated_offset_t) ;
            }

            current_offset += wrote ;
        }
    }

    (*(uint32_t*)(data + 0)) = current_offset ;
    return current_offset;
}

/** type Column **/

static inline Column* Column_safe_cast ( const char* data, size_t max_length ) {
    if ( max_length < 4 )
        return NULL;

    size_t read_length = Column_length( (Column*)data ) ;

    if ( read_length > max_length )
        return NULL;

    return (Column*)data ;
}

size_t static inline Column_length ( Column* data ) {
    return (size_t)((uint32_t*)data)[ 0 ] ;
}

size_t static inline compute_Column_length ( struct Column_builder* builder ) {
    if ( builder == NULL )
        return 0 ;

    if ( builder->prebuilt == true ) {
        if ( builder->prebuilt_data == NULL )
            return 0 ;
        else
            return Column_length( builder->prebuilt_data ) ;
    }

    size_t length = 37 ;
    length += builder->name.length ;
    length += builder->units.length ;
    length += compute_varint64_vector_length(
                  builder->values.data,
                  builder->values.count );
    return length;
}

///// Field accessors /////

static inline uint32_t Column_raw_start_baseValue ( Column* data ) {
    return 12 ;
}

static inline uint32_t Column_raw_end_baseValue ( Column* data ) {
    return 12 + 8 ;
}

static inline const char* Column_read_raw_baseValue ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_baseValue( data ) ;
    uint32_t end_offset   = Column_raw_end_baseValue( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_baseValue ( Column* data ) {
    uint32_t start_offset = Column_raw_start_baseValue( data ) ;
    uint32_t end_offset   = Column_raw_end_baseValue( data ) ;
    return end_offset - start_offset ;
}

static inline int64_t Column_read_baseValue ( Column* data ) {
    uint32_t start_offset = Column_raw_start_baseValue( data ) ;
    int64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t Column_length_baseValue ( Column* data ) {
    return Column_length_raw_baseValue( data ) ;
}

static inline size_t Column_end_baseValue ( Column* data ) {
    uint32_t end_offset = Column_raw_end_baseValue( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_valueFactor ( Column* data ) {
    return 20 ;
}

static inline uint32_t Column_raw_end_valueFactor ( Column* data ) {
    return 20 + 1 ;
}

static inline const char* Column_read_raw_valueFactor ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_valueFactor( data ) ;
    uint32_t end_offset   = Column_raw_end_valueFactor( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_valueFactor ( Column* data ) {
    uint32_t start_offset = Column_raw_start_valueFactor( data ) ;
    uint32_t end_offset   = Column_raw_end_valueFactor( data ) ;
    return end_offset - start_offset ;
}

static inline int8_t Column_read_valueFactor ( Column* data ) {
    uint32_t start_offset = Column_raw_start_valueFactor( data ) ;
    int8_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t Column_length_valueFactor ( Column* data ) {
    return Column_length_raw_valueFactor( data ) ;
}

static inline size_t Column_end_valueFactor ( Column* data ) {
    uint32_t end_offset = Column_raw_end_valueFactor( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_max ( Column* data ) {
    return 21 ;
}

static inline uint32_t Column_raw_end_max ( Column* data ) {
    return 21 + 8 ;
}

static inline const char* Column_read_raw_max ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_max( data ) ;
    uint32_t end_offset   = Column_raw_end_max( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_max ( Column* data ) {
    uint32_t start_offset = Column_raw_start_max( data ) ;
    uint32_t end_offset   = Column_raw_end_max( data ) ;
    return end_offset - start_offset ;
}

static inline int64_t Column_read_max ( Column* data ) {
    uint32_t start_offset = Column_raw_start_max( data ) ;
    int64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t Column_length_max ( Column* data ) {
    return Column_length_raw_max( data ) ;
}

static inline size_t Column_end_max ( Column* data ) {
    uint32_t end_offset = Column_raw_end_max( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_min ( Column* data ) {
    return 29 ;
}

static inline uint32_t Column_raw_end_min ( Column* data ) {
    return 29 + 8 ;
}

static inline const char* Column_read_raw_min ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_min( data ) ;
    uint32_t end_offset   = Column_raw_end_min( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_min ( Column* data ) {
    uint32_t start_offset = Column_raw_start_min( data ) ;
    uint32_t end_offset   = Column_raw_end_min( data ) ;
    return end_offset - start_offset ;
}

static inline int64_t Column_read_min ( Column* data ) {
    uint32_t start_offset = Column_raw_start_min( data ) ;
    int64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t Column_length_min ( Column* data ) {
    return Column_length_raw_min( data ) ;
}

static inline size_t Column_end_min ( Column* data ) {
    uint32_t end_offset = Column_raw_end_min( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_name ( Column* data ) {
    return 37;
}

static inline uint32_t Column_raw_end_name ( Column* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline const char* Column_read_raw_name ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_name( data ) ;
    uint32_t end_offset   = Column_raw_end_name( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_name ( Column* data ) {
    uint32_t start_offset = Column_raw_start_name( data ) ;
    uint32_t end_offset   = Column_raw_end_name( data ) ;
    return end_offset - start_offset ;
}

static inline char* Column_read_name ( Column* data ) {
    uint32_t start_offset = Column_raw_start_name( data ) ;
    char* result;
    result = (char*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t Column_length_name ( Column* data ) {
    return Column_length_raw_name( data ) ;
}

static inline size_t Column_end_name ( Column* data ) {
    uint32_t end_offset = Column_raw_end_name( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_units ( Column* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline uint32_t Column_raw_end_units ( Column* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline const char* Column_read_raw_units ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_units( data ) ;
    uint32_t end_offset   = Column_raw_end_units( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_units ( Column* data ) {
    uint32_t start_offset = Column_raw_start_units( data ) ;
    uint32_t end_offset   = Column_raw_end_units( data ) ;
    return end_offset - start_offset ;
}

static inline char* Column_read_units ( Column* data ) {
    uint32_t start_offset = Column_raw_start_units( data ) ;
    char* result;
    result = (char*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t Column_length_units ( Column* data ) {
    return Column_length_raw_units( data ) ;
}

static inline size_t Column_end_units ( Column* data ) {
    uint32_t end_offset = Column_raw_end_units( data ) ;
    return end_offset ;
}

static inline uint32_t Column_raw_start_values ( Column* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline uint32_t Column_raw_end_values ( Column* data ) {
    uint32_t result;
    loadValue( result, data, 0 );
    return result;
}

static inline const char* Column_read_raw_values ( Column* data ) {
    size_t message_length = Column_length( data ) ;
    uint32_t start_offset = Column_raw_start_values( data ) ;
    uint32_t end_offset   = Column_raw_end_values( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t Column_length_raw_values ( Column* data ) {
    uint32_t start_offset = Column_raw_start_values( data ) ;
    uint32_t end_offset   = Column_raw_end_values( data ) ;
    return end_offset - start_offset ;
}

static inline varIntVec_t* Column_read_values ( Column* data ) {
    uint32_t start_offset = Column_raw_start_values( data ) ;
    varIntVec_t* result;
    result = (varIntVec_t*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t Column_length_values ( Column* data ) {
    return Column_length_raw_values( data ) ;
}

static inline size_t Column_end_values ( Column* data ) {
    uint32_t end_offset = Column_raw_end_values( data ) ;
    return end_offset ;
}

//// Builder ////

static inline size_t build_Column ( char* data, size_t length, struct Column_builder* builder_data ) {
    if ( builder_data == NULL )
        return 0 ;

    if ( length < 37 )
        return 0 ;

    size_t current_offset = 37 ;

    if ( builder_data->prebuilt == true ) {
        if ( builder_data->prebuilt_data == NULL )
            return 0 ;
        else {
            size_t prebuilt_length = Column_length( builder_data->prebuilt_data ) ;

            if ( length < prebuilt_length )
                return 0 ;
            else {
                memcpy( data, (const char*)builder_data->prebuilt_data, prebuilt_length ) ;
                return prebuilt_length ;
            }
        }
    }

    memcpy( data + 12, (const char*)&builder_data->baseValue, 8 ) ;
    memcpy( data + 20, (const char*)&builder_data->valueFactor, 1 ) ;
    memcpy( data + 21, (const char*)&builder_data->max, 8 ) ;
    memcpy( data + 29, (const char*)&builder_data->min, 8 ) ;

    if ( length < current_offset + builder_data->name.length )
        return 0 ;

    memcpy( data + current_offset, (const char*)builder_data->name.data, builder_data->name.length ) ;
    current_offset += builder_data->name.length ;
    (*(uint32_t*)(data + 8)) = current_offset ;

    if ( length < current_offset + builder_data->units.length )
        return 0 ;

    memcpy( data + current_offset, (const char*)builder_data->units.data, builder_data->units.length ) ;
    current_offset += builder_data->units.length ;
    (*(uint32_t*)(data + 4)) = current_offset ;
    write_varint64_vector_result varInt_result =
        write_varint64_vector( builder_data->values.data,
                               builder_data->values.count,
                               (varIntVec_t*)data,
                               current_offset, length );

    if ( varInt_result.count != builder_data->values.count )
        return 0 ;

    current_offset += varInt_result.worte ;

    if ( length < current_offset )
        return 0;

    (*(uint32_t*)(data + 0)) = current_offset ;
    return current_offset;
}

/** type DataTile **/

static inline DataTile* DataTile_safe_cast ( const char* data, size_t max_length ) {
    if ( max_length < 4 )
        return NULL;

    size_t read_length = DataTile_length( (DataTile*)data ) ;

    if ( read_length > max_length )
        return NULL;

    return (DataTile*)data ;
}

size_t static inline DataTile_length ( DataTile* data ) {
    return (size_t)((uint32_t*)data)[ 0 ] ;
}

size_t static inline compute_DataTile_length ( struct DataTile_builder* builder ) {
    if ( builder == NULL )
        return 0 ;

    if ( builder->prebuilt == true ) {
        if ( builder->prebuilt_data == NULL )
            return 0 ;
        else
            return DataTile_length( builder->prebuilt_data ) ;
    }

    size_t length = 64 ;
    length += builder->units.length ;
    length += sizeof( repeated_count_t ) ;
    length += builder->values.count * 8 ;
    length += sizeof( repeated_count_t ) ;
    length += builder->samples.count * 8 ;
    length += builder->varianceType.length ;
    length += sizeof( repeated_count_t ) ;
    length += builder->variance1.count * 8 ;
    length += sizeof( repeated_count_t ) ;
    length += builder->variance2.count * 8 ;
    length += sizeof( repeated_count_t ) ;
    length += builder->times.count * 8 ;
    return length;
}

///// Field accessors /////

static inline uint32_t DataTile_raw_start_encoding ( DataTile* data ) {
    return 28 ;
}

static inline uint32_t DataTile_raw_end_encoding ( DataTile* data ) {
    return 28 + 1 ;
}

static inline const char* DataTile_read_raw_encoding ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_encoding( data ) ;
    uint32_t end_offset   = DataTile_raw_end_encoding( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_encoding ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_encoding( data ) ;
    uint32_t end_offset   = DataTile_raw_end_encoding( data ) ;
    return end_offset - start_offset ;
}

static inline uint8_t DataTile_read_encoding ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_encoding( data ) ;
    uint8_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_encoding ( DataTile* data ) {
    return DataTile_length_raw_encoding( data ) ;
}

static inline size_t DataTile_end_encoding ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_encoding( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_aggregation ( DataTile* data ) {
    return 29 ;
}

static inline uint32_t DataTile_raw_end_aggregation ( DataTile* data ) {
    return 29 + 1 ;
}

static inline const char* DataTile_read_raw_aggregation ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_aggregation( data ) ;
    uint32_t end_offset   = DataTile_raw_end_aggregation( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_aggregation ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_aggregation( data ) ;
    uint32_t end_offset   = DataTile_raw_end_aggregation( data ) ;
    return end_offset - start_offset ;
}

static inline uint8_t DataTile_read_aggregation ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_aggregation( data ) ;
    uint8_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_aggregation ( DataTile* data ) {
    return DataTile_length_raw_aggregation( data ) ;
}

static inline size_t DataTile_end_aggregation ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_aggregation( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_epoc ( DataTile* data ) {
    return 30 ;
}

static inline uint32_t DataTile_raw_end_epoc ( DataTile* data ) {
    return 30 + 8 ;
}

static inline const char* DataTile_read_raw_epoc ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_epoc( data ) ;
    uint32_t end_offset   = DataTile_raw_end_epoc( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_epoc ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_epoc( data ) ;
    uint32_t end_offset   = DataTile_raw_end_epoc( data ) ;
    return end_offset - start_offset ;
}

static inline int64_t DataTile_read_epoc ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_epoc( data ) ;
    int64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_epoc ( DataTile* data ) {
    return DataTile_length_raw_epoc( data ) ;
}

static inline size_t DataTile_end_epoc ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_epoc( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_startTime ( DataTile* data ) {
    return 38 ;
}

static inline uint32_t DataTile_raw_end_startTime ( DataTile* data ) {
    return 38 + 8 ;
}

static inline const char* DataTile_read_raw_startTime ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_startTime( data ) ;
    uint32_t end_offset   = DataTile_raw_end_startTime( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_startTime ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_startTime( data ) ;
    uint32_t end_offset   = DataTile_raw_end_startTime( data ) ;
    return end_offset - start_offset ;
}

static inline uint64_t DataTile_read_startTime ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_startTime( data ) ;
    uint64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_startTime ( DataTile* data ) {
    return DataTile_length_raw_startTime( data ) ;
}

static inline size_t DataTile_end_startTime ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_startTime( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_timeFactor ( DataTile* data ) {
    return 46 ;
}

static inline uint32_t DataTile_raw_end_timeFactor ( DataTile* data ) {
    return 46 + 1 ;
}

static inline const char* DataTile_read_raw_timeFactor ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_timeFactor( data ) ;
    uint32_t end_offset   = DataTile_raw_end_timeFactor( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_timeFactor ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_timeFactor( data ) ;
    uint32_t end_offset   = DataTile_raw_end_timeFactor( data ) ;
    return end_offset - start_offset ;
}

static inline int8_t DataTile_read_timeFactor ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_timeFactor( data ) ;
    int8_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_timeFactor ( DataTile* data ) {
    return DataTile_length_raw_timeFactor( data ) ;
}

static inline size_t DataTile_end_timeFactor ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_timeFactor( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_duration ( DataTile* data ) {
    return 47 ;
}

static inline uint32_t DataTile_raw_end_duration ( DataTile* data ) {
    return 47 + 8 ;
}

static inline const char* DataTile_read_raw_duration ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_duration( data ) ;
    uint32_t end_offset   = DataTile_raw_end_duration( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_duration ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_duration( data ) ;
    uint32_t end_offset   = DataTile_raw_end_duration( data ) ;
    return end_offset - start_offset ;
}

static inline uint64_t DataTile_read_duration ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_duration( data ) ;
    uint64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_duration ( DataTile* data ) {
    return DataTile_length_raw_duration( data ) ;
}

static inline size_t DataTile_end_duration ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_duration( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_baseValue ( DataTile* data ) {
    return 55 ;
}

static inline uint32_t DataTile_raw_end_baseValue ( DataTile* data ) {
    return 55 + 8 ;
}

static inline const char* DataTile_read_raw_baseValue ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_baseValue( data ) ;
    uint32_t end_offset   = DataTile_raw_end_baseValue( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_baseValue ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_baseValue( data ) ;
    uint32_t end_offset   = DataTile_raw_end_baseValue( data ) ;
    return end_offset - start_offset ;
}

static inline int64_t DataTile_read_baseValue ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_baseValue( data ) ;
    int64_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_baseValue ( DataTile* data ) {
    return DataTile_length_raw_baseValue( data ) ;
}

static inline size_t DataTile_end_baseValue ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_baseValue( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_valueFactor ( DataTile* data ) {
    return 63 ;
}

static inline uint32_t DataTile_raw_end_valueFactor ( DataTile* data ) {
    return 63 + 1 ;
}

static inline const char* DataTile_read_raw_valueFactor ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_valueFactor( data ) ;
    uint32_t end_offset   = DataTile_raw_end_valueFactor( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_valueFactor ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_valueFactor( data ) ;
    uint32_t end_offset   = DataTile_raw_end_valueFactor( data ) ;
    return end_offset - start_offset ;
}

static inline int8_t DataTile_read_valueFactor ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_valueFactor( data ) ;
    int8_t result;
    loadValue( result, data, start_offset );
    return result;
}

static inline size_t DataTile_length_valueFactor ( DataTile* data ) {
    return DataTile_length_raw_valueFactor( data ) ;
}

static inline size_t DataTile_end_valueFactor ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_valueFactor( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_units ( DataTile* data ) {
    return 64;
}

static inline uint32_t DataTile_raw_end_units ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 24 );
    return result;
}

static inline const char* DataTile_read_raw_units ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_units( data ) ;
    uint32_t end_offset   = DataTile_raw_end_units( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_units ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_units( data ) ;
    uint32_t end_offset   = DataTile_raw_end_units( data ) ;
    return end_offset - start_offset ;
}

static inline char* DataTile_read_units ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_units( data ) ;
    char* result;
    result = (char*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t DataTile_length_units ( DataTile* data ) {
    return DataTile_length_raw_units( data ) ;
}

static inline size_t DataTile_end_units ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_units( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_values ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 24 );
    return result;
}

static inline uint32_t DataTile_raw_end_values ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 20 );
    return result;
}

static inline const char* DataTile_read_raw_values ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_values( data ) ;
    uint32_t end_offset   = DataTile_raw_end_values( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_values ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_values( data ) ;
    uint32_t end_offset   = DataTile_raw_end_values( data ) ;
    return end_offset - start_offset ;
}

static inline size_t DataTile_start_values ( DataTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = DataTile_length( data ) ;
    uint32_t start_offset   = DataTile_raw_start_values( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( ( start_offset + sizeof( repeated_count_t )
            + ( index * sizeof( int64_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 ;
    else {
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof(int64_t) * index ) ;
    }

    return (size_t)result ;
}

static inline size_t DataTile_end_values ( DataTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = DataTile_raw_start_values( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = DataTile_raw_end_values( data ) ;
    else
        result = DataTile_start_values( data, index + 1 ) ;

    return result ;
}

static inline uint32_t DataTile_count_values ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_values( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline int64_t DataTile_read_values ( DataTile* data, uint32_t index ) {
    size_t message_length = DataTile_length( data ) ;
    size_t field_end      = DataTile_end_values( data, index ) ;
    size_t field_start    = DataTile_start_values( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (int64_t)0 ;

    int64_t result;
    loadValue( result, data, field_start );
    return result;
}

static inline size_t DataTile_length_values ( DataTile* data, uint32_t index ) {
    size_t field_end   = DataTile_end_values( data, index ) ;
    size_t field_start = DataTile_start_values( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

static inline uint32_t DataTile_raw_start_samples ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 20 );
    return result;
}

static inline uint32_t DataTile_raw_end_samples ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 16 );
    return result;
}

static inline const char* DataTile_read_raw_samples ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_samples( data ) ;
    uint32_t end_offset   = DataTile_raw_end_samples( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_samples ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_samples( data ) ;
    uint32_t end_offset   = DataTile_raw_end_samples( data ) ;
    return end_offset - start_offset ;
}

static inline size_t DataTile_start_samples ( DataTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = DataTile_length( data ) ;
    uint32_t start_offset   = DataTile_raw_start_samples( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( ( start_offset + sizeof( repeated_count_t )
            + ( index * sizeof( uint64_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 ;
    else {
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof(uint64_t) * index ) ;
    }

    return (size_t)result ;
}

static inline size_t DataTile_end_samples ( DataTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = DataTile_raw_start_samples( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = DataTile_raw_end_samples( data ) ;
    else
        result = DataTile_start_samples( data, index + 1 ) ;

    return result ;
}

static inline uint32_t DataTile_count_samples ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_samples( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline uint64_t DataTile_read_samples ( DataTile* data, uint32_t index ) {
    size_t message_length = DataTile_length( data ) ;
    size_t field_end      = DataTile_end_samples( data, index ) ;
    size_t field_start    = DataTile_start_samples( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (uint64_t)0 ;

    uint64_t result;
    loadValue( result, data, field_start );
    return result;
}

static inline size_t DataTile_length_samples ( DataTile* data, uint32_t index ) {
    size_t field_end   = DataTile_end_samples( data, index ) ;
    size_t field_start = DataTile_start_samples( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

static inline uint32_t DataTile_raw_start_varianceType ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 16 );
    return result;
}

static inline uint32_t DataTile_raw_end_varianceType ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 12 );
    return result;
}

static inline const char* DataTile_read_raw_varianceType ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_varianceType( data ) ;
    uint32_t end_offset   = DataTile_raw_end_varianceType( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_varianceType ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_varianceType( data ) ;
    uint32_t end_offset   = DataTile_raw_end_varianceType( data ) ;
    return end_offset - start_offset ;
}

static inline char* DataTile_read_varianceType ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_varianceType( data ) ;
    char* result;
    result = (char*)( ((const char*)data) + start_offset ) ;
    return result;
}

static inline size_t DataTile_length_varianceType ( DataTile* data ) {
    return DataTile_length_raw_varianceType( data ) ;
}

static inline size_t DataTile_end_varianceType ( DataTile* data ) {
    uint32_t end_offset = DataTile_raw_end_varianceType( data ) ;
    return end_offset ;
}

static inline uint32_t DataTile_raw_start_variance1 ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 12 );
    return result;
}

static inline uint32_t DataTile_raw_end_variance1 ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline const char* DataTile_read_raw_variance1 ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_variance1( data ) ;
    uint32_t end_offset   = DataTile_raw_end_variance1( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_variance1 ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_variance1( data ) ;
    uint32_t end_offset   = DataTile_raw_end_variance1( data ) ;
    return end_offset - start_offset ;
}

static inline size_t DataTile_start_variance1 ( DataTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = DataTile_length( data ) ;
    uint32_t start_offset   = DataTile_raw_start_variance1( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( ( start_offset + sizeof( repeated_count_t )
            + ( index * sizeof( int64_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 ;
    else {
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof(int64_t) * index ) ;
    }

    return (size_t)result ;
}

static inline size_t DataTile_end_variance1 ( DataTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = DataTile_raw_start_variance1( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = DataTile_raw_end_variance1( data ) ;
    else
        result = DataTile_start_variance1( data, index + 1 ) ;

    return result ;
}

static inline uint32_t DataTile_count_variance1 ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_variance1( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline int64_t DataTile_read_variance1 ( DataTile* data, uint32_t index ) {
    size_t message_length = DataTile_length( data ) ;
    size_t field_end      = DataTile_end_variance1( data, index ) ;
    size_t field_start    = DataTile_start_variance1( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (int64_t)0 ;

    int64_t result;
    loadValue( result, data, field_start );
    return result;
}

static inline size_t DataTile_length_variance1 ( DataTile* data, uint32_t index ) {
    size_t field_end   = DataTile_end_variance1( data, index ) ;
    size_t field_start = DataTile_start_variance1( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

static inline uint32_t DataTile_raw_start_variance2 ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 8 );
    return result;
}

static inline uint32_t DataTile_raw_end_variance2 ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline const char* DataTile_read_raw_variance2 ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_variance2( data ) ;
    uint32_t end_offset   = DataTile_raw_end_variance2( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_variance2 ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_variance2( data ) ;
    uint32_t end_offset   = DataTile_raw_end_variance2( data ) ;
    return end_offset - start_offset ;
}

static inline size_t DataTile_start_variance2 ( DataTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = DataTile_length( data ) ;
    uint32_t start_offset   = DataTile_raw_start_variance2( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( ( start_offset + sizeof( repeated_count_t )
            + ( index * sizeof( int64_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 ;
    else {
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof(int64_t) * index ) ;
    }

    return (size_t)result ;
}

static inline size_t DataTile_end_variance2 ( DataTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = DataTile_raw_start_variance2( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = DataTile_raw_end_variance2( data ) ;
    else
        result = DataTile_start_variance2( data, index + 1 ) ;

    return result ;
}

static inline uint32_t DataTile_count_variance2 ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_variance2( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline int64_t DataTile_read_variance2 ( DataTile* data, uint32_t index ) {
    size_t message_length = DataTile_length( data ) ;
    size_t field_end      = DataTile_end_variance2( data, index ) ;
    size_t field_start    = DataTile_start_variance2( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (int64_t)0 ;

    int64_t result;
    loadValue( result, data, field_start );
    return result;
}

static inline size_t DataTile_length_variance2 ( DataTile* data, uint32_t index ) {
    size_t field_end   = DataTile_end_variance2( data, index ) ;
    size_t field_start = DataTile_start_variance2( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

static inline uint32_t DataTile_raw_start_times ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 4 );
    return result;
}

static inline uint32_t DataTile_raw_end_times ( DataTile* data ) {
    uint32_t result;
    loadValue( result, data, 0 );
    return result;
}

static inline const char* DataTile_read_raw_times ( DataTile* data ) {
    size_t message_length = DataTile_length( data ) ;
    uint32_t start_offset = DataTile_raw_start_times( data ) ;
    uint32_t end_offset   = DataTile_raw_end_times( data ) ;

    if ( end_offset > message_length )
        return NULL ;

    return  ((const char*)data) + start_offset ;
}

static inline size_t DataTile_length_raw_times ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_times( data ) ;
    uint32_t end_offset   = DataTile_raw_end_times( data ) ;
    return end_offset - start_offset ;
}

static inline size_t DataTile_start_times ( DataTile* data, uint32_t index ) {
    uint32_t result ;
    size_t   message_length = DataTile_length( data ) ;
    uint32_t start_offset   = DataTile_raw_start_times( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;

    if ( ( start_offset + sizeof( repeated_count_t )
            + ( index * sizeof( uint64_t ) ) ) > message_length )
        return 0 ;

    if ( index == 0 )
        result = start_offset + sizeof( repeated_count_t )
                 ;
    else {
        result = start_offset + sizeof( repeated_count_t )
                 + ( sizeof(uint64_t) * index ) ;
    }

    return (size_t)result ;
}

static inline size_t DataTile_end_times ( DataTile* data, uint32_t index ) {
    size_t result ;
    uint32_t start_offset = DataTile_raw_start_times( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );

    if ( index >= count )
        return 0 ;
    else if ( index == count - 1 )
        result = DataTile_raw_end_times( data ) ;
    else
        result = DataTile_start_times( data, index + 1 ) ;

    return result ;
}

static inline uint32_t DataTile_count_times ( DataTile* data ) {
    uint32_t start_offset = DataTile_raw_start_times( data ) ;
    repeated_count_t count;
    loadValue( count, data, start_offset );
    return (uint32_t)count;
}

static inline uint64_t DataTile_read_times ( DataTile* data, uint32_t index ) {
    size_t message_length = DataTile_length( data ) ;
    size_t field_end      = DataTile_end_times( data, index ) ;
    size_t field_start    = DataTile_start_times( data, index ) ;

    if ( (field_end > message_length) || (field_start == 0) || (field_end == 0) )
        return (uint64_t)0 ;

    uint64_t result;
    loadValue( result, data, field_start );
    return result;
}

static inline size_t DataTile_length_times ( DataTile* data, uint32_t index ) {
    size_t field_end   = DataTile_end_times( data, index ) ;
    size_t field_start = DataTile_start_times( data, index ) ;

    if ( field_start == 0 || field_end == 0 )
        return 0 ;

    return field_end - field_start ;
}

//// Builder ////

static inline size_t build_DataTile ( char* data, size_t length, struct DataTile_builder* builder_data ) {
    if ( builder_data == NULL )
        return 0 ;

    if ( length < 64 )
        return 0 ;

    size_t current_offset = 64 ;

    if ( builder_data->prebuilt == true ) {
        if ( builder_data->prebuilt_data == NULL )
            return 0 ;
        else {
            size_t prebuilt_length = DataTile_length( builder_data->prebuilt_data ) ;

            if ( length < prebuilt_length )
                return 0 ;
            else {
                memcpy( data, (const char*)builder_data->prebuilt_data, prebuilt_length ) ;
                return prebuilt_length ;
            }
        }
    }

    memcpy( data + 28, (const char*)&builder_data->encoding, 1 ) ;
    memcpy( data + 29, (const char*)&builder_data->aggregation, 1 ) ;
    memcpy( data + 30, (const char*)&builder_data->epoc, 8 ) ;
    memcpy( data + 38, (const char*)&builder_data->startTime, 8 ) ;
    memcpy( data + 46, (const char*)&builder_data->timeFactor, 1 ) ;
    memcpy( data + 47, (const char*)&builder_data->duration, 8 ) ;
    memcpy( data + 55, (const char*)&builder_data->baseValue, 8 ) ;
    memcpy( data + 63, (const char*)&builder_data->valueFactor, 1 ) ;

    if ( length < current_offset + builder_data->units.length )
        return 0 ;

    memcpy( data + current_offset, (const char*)builder_data->units.data, builder_data->units.length ) ;
    current_offset += builder_data->units.length ;
    (*(uint32_t*)(data + 24)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->values.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);

    for ( size_t i = 0 ; i < builder_data->values.count ; i++ ) {
        if ( length < current_offset + 8 )
            return 0 ;

        memcpy( data + current_offset, (const char*)&builder_data->values.data[i], 8 ) ;
        current_offset += 8 ;
    }

    (*(uint32_t*)(data + 20)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->samples.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);

    for ( size_t i = 0 ; i < builder_data->samples.count ; i++ ) {
        if ( length < current_offset + 8 )
            return 0 ;

        memcpy( data + current_offset, (const char*)&builder_data->samples.data[i], 8 ) ;
        current_offset += 8 ;
    }

    (*(uint32_t*)(data + 16)) = current_offset ;

    if ( length < current_offset + builder_data->varianceType.length )
        return 0 ;

    memcpy( data + current_offset, (const char*)builder_data->varianceType.data, builder_data->varianceType.length ) ;
    current_offset += builder_data->varianceType.length ;
    (*(uint32_t*)(data + 12)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->variance1.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);

    for ( size_t i = 0 ; i < builder_data->variance1.count ; i++ ) {
        if ( length < current_offset + 8 )
            return 0 ;

        memcpy( data + current_offset, (const char*)&builder_data->variance1.data[i], 8 ) ;
        current_offset += 8 ;
    }

    (*(uint32_t*)(data + 8)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->variance2.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);

    for ( size_t i = 0 ; i < builder_data->variance2.count ; i++ ) {
        if ( length < current_offset + 8 )
            return 0 ;

        memcpy( data + current_offset, (const char*)&builder_data->variance2.data[i], 8 ) ;
        current_offset += 8 ;
    }

    (*(uint32_t*)(data + 4)) = current_offset ;

    if ( length < current_offset + sizeof(repeated_count_t) )
        return 0 ;

    memcpy( data + current_offset, (const char*)&builder_data->times.count, sizeof(repeated_count_t) ) ;
    current_offset += sizeof(repeated_count_t);

    for ( size_t i = 0 ; i < builder_data->times.count ; i++ ) {
        if ( length < current_offset + 8 )
            return 0 ;

        memcpy( data + current_offset, (const char*)&builder_data->times.data[i], 8 ) ;
        current_offset += 8 ;
    }

    (*(uint32_t*)(data + 0)) = current_offset ;
    return current_offset;
}

static inline size_t build_TaggedField ( char* data, size_t length, struct TaggedField_builder* builder_data ) {
    if ( length < 8 )
        return 0 ;

    if ( builder_data == NULL )
        return 0 ;

    size_t wrote ;
    memcpy( data, (const char*)&builder_data->tag, sizeof( uint64_t ) ) ;

    if ( builder_data->prebuilt == true ) {
        if ( ( length - sizeof( uint64_t ) ) < builder_data->prebuilt_length )
            return 0 ;
        else if ( ( builder_data->prebuilt_length != 0 ) && ( builder_data->prebuilt_data == NULL ) )
            return 0 ;
        else {
            memcpy( data + sizeof( uint64_t ), (const char*)builder_data->prebuilt_data, builder_data->prebuilt_length ) ;
            wrote = builder_data->prebuilt_length ;
        }
    }
    else {
        switch( builder_data->tag ) {
        case 0x58df377554a76f9b :
            wrote = build_TableTile( data + sizeof( uint64_t ),  length - sizeof( uint64_t ), (struct TableTile_builder*)builder_data->data ) ;
            break ;

        case 0x941e36daa222f129 :
            wrote = build_Column( data + sizeof( uint64_t ),  length - sizeof( uint64_t ), (struct Column_builder*)builder_data->data ) ;
            break ;

        case 0xb5d908ab36ecbbbe :
            wrote = build_DataTile( data + sizeof( uint64_t ),  length - sizeof( uint64_t ), (struct DataTile_builder*)builder_data->data ) ;
            break ;

        default:
            wrote = 0 ;
            break ;
        }
    }

    if ( wrote > 0 )
        wrote += sizeof( uint64_t ) ;

    return wrote ;
}

size_t static inline compute_TaggedField_length ( struct TaggedField_builder* builder_data ) {
    size_t length ;

    if ( builder_data->prebuilt == true )
        length = builder_data->prebuilt_length ;
    else {
        switch( builder_data->tag ) {
        case 0x58df377554a76f9b :
            length = compute_TableTile_length( (struct TableTile_builder*)builder_data->data ) ;
            break ;

        case 0x941e36daa222f129 :
            length = compute_Column_length( (struct Column_builder*)builder_data->data ) ;
            break ;

        case 0xb5d908ab36ecbbbe :
            length = compute_DataTile_length( (struct DataTile_builder*)builder_data->data ) ;
            break ;

        default:
            length = 0 ;
            break ;
        }
    }

    if ( length > 0 )
        length += sizeof( uint64_t ) ;

    return length ;
}

#endif /* MESSAGE_IMPLMENTATION_H  */

