#include <stdlib.h>
#include <stdint.h>
#include <math.h>
#include <emscripten.h>
#include "data_tile.h"

typedef struct {
  Column *column;
  double valueFactor;
  double value;
} column_t ;

typedef struct {
  size_t   count ;
  uint32_t index ;
  uint32_t columnCount;
  column_t indexColumn;
  column_t *columns;
  
} iterator_t ;


extern "C" {

  double readIndexStart ( TableTile* messageData ) {

    Column *indexColumn = TableTile_read_indexColumn( messageData );
    return
      pow(10, Column_read_valueFactor( indexColumn )) 
      * (double)(Column_read_min( indexColumn ));
  }

  void initColumn ( Column *column, column_t *iterator_column ) {
    iterator_column->column = column;

    iterator_column->valueFactor =
      pow( 10, Column_read_valueFactor( column ) ); 

    iterator_column->value =
      Column_read_baseValue( column )
      * iterator_column->valueFactor;
  }

  iterator_t* initIterator ( TableTile* messageData ) {

    iterator_t *iterator = (iterator_t*)malloc(sizeof(iterator_t));

    Column *indexColumn = TableTile_read_indexColumn( messageData );

    iterator->count       = Column_count_values( indexColumn );
    iterator->index       = 0;
    iterator->columnCount = TableTile_count_columns( messageData );

    initColumn( indexColumn, &(iterator->indexColumn) );

    column_t *columns = (column_t *)malloc( sizeof(column_t) * iterator->columnCount );

    for ( int i = 0 ; i < iterator->columnCount ; i++ ) {
      Column *col = TableTile_read_columns( messageData, i );
      initColumn( col, &columns[i] );
    }

    iterator->columns = columns;

    return iterator;
  }
  
  void finishIterator (iterator_t* iterator) {
    free(iterator->columns);
    free(iterator);
  }

  void updateColumn ( column_t *column, uint32_t index ) {
    column->value = column->value
      + column->valueFactor * (double)Column_read_values( column->column, index );
  }

  bool nextValue ( TableTile* messageData, iterator_t* iterator ) {
    
    uint32_t index = iterator->index;
    
    if ( index >= iterator->count )
      return false;
    updateColumn( &iterator->indexColumn, index );
    
    column_t *columns = iterator->columns;

    for ( int i = 0 ; i < iterator->columnCount ; i++ ) {
      updateColumn( &columns[i], index );
    }

    iterator->index++;
    return true;
  }


  double readValue ( iterator_t *iterator, uint32_t index ) {
    double result;

    if ( index == 0 )
      result = iterator->indexColumn.value;

    else if ( index <= iterator->columnCount )
      result = iterator->columns[ index - 1 ].value;

    else
      result = 0;

    return result;
  }

  double readColumnMin( iterator_t *iterator, uint32_t index ) {
    double result;

    if ( index == 0 )
      result = iterator->indexColumn.valueFactor 
	* (double)Column_read_min( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = iterator->columns[ index - 1 ].valueFactor
	        * (double)Column_read_min( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

  double readColumnMax( iterator_t *iterator, uint32_t index ) {
    double result;

    if ( index == 0 )
      result = iterator->indexColumn.valueFactor 
	* (double)Column_read_max( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = iterator->columns[ index - 1 ].valueFactor
	        * (double)Column_read_max( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

  double readEntriesCount( iterator_t *iterator, uint32_t index ) {
    return (double)iterator->count;
  }


  uint32_t getColumCount ( iterator_t *iterator ) {
    return iterator->columnCount + 1;
  }

  char* getName ( iterator_t *iterator, uint32_t index ) {
    char *result;

    if ( index == 0 )
      result = Column_read_name( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = Column_read_name( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

  size_t getNameLength ( iterator_t *iterator, uint32_t index ) {
    size_t result;

    if ( index == 0 )
      result = Column_length_name( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = Column_length_name( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

  char* getUnits ( iterator_t *iterator, uint32_t index ) {
    char *result;

    if ( index == 0 )
      result = Column_read_units( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = Column_read_units( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

  size_t getUnitsLength ( iterator_t *iterator, uint32_t index ) {
    size_t result;

    if ( index == 0 )
      result = Column_length_units( iterator->indexColumn.column );

    else if ( index <= iterator->columnCount )
      result = Column_length_units( iterator->columns[ index - 1 ].column );

    else
      result = 0;

    return result;
  }

}

