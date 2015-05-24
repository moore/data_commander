EMCC = emcc
SOURCES = src/c/dc.cpp
POST_JS = src/js/post.js


DIST      = dist
HTDOCS    = htdocs
BUILD_DIR = build

BUILD_JS_DIR = ${BUILD_DIR}/js

MESSAGE_HEADDERS_DIR = ${BUILD_DIR}/message_headders
MESSAGE_HEADDERS     = ${MESSAGE_HEADDERS_DIR}/data_tile.h

MESSAGE_JSON = src/convexstruct/dc.json

EMFLAGS = -s EXPORTED_FUNCTIONS="['_initIterator', '_nextValue', '_finishIterator']" --post-js $(POST_JS) -std=c++11 -I${MESSAGE_HEADDERS_DIR}

.PHONY: all clean distclean 
all:: js

${BUILD_JS_DIR}:
	mkdir -p ${BUILD_JS_DIR}

messages : ${MESSAGE_HEADDERS}

js: ${BUILD_JS_DIR} ${MESSAGE_HEADDERS}
	$(EMCC) -O1 $(EMFLAGS) $(SOURCES) -o ${BUILD_JS_DIR}/dc.js

${HTDOCS}: js
	mkdir -p ${HTDOCS}
	cp ${BUILD_JS_DIR}/* ${HTDOCS}
	cp test/html/test.html ${HTDOCS}

${MESSAGE_HEADDERS_DIR}:
	mkdir -p ${MESSAGE_HEADDERS_DIR}

${MESSAGE_HEADDERS} : ${MESSAGE_HEADDERS_DIR}
	messagebuilder c ${MESSAGE_JSON} | cat -s > ${MESSAGE_HEADDERS}
	astyle --delete-empty-lines --break-blocks --break-closing-brackets ${MESSAGE_HEADDERS}

server : ${HTDOCS}
	cd ${HTDOCS} && python -m SimpleHTTPServer 8000


clean:: 
	-rm -rf ${BUILD_DIR} ${HTDOCS}

distclean:: clean
	-rm -rf ${DIST}
