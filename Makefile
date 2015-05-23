EMCC = emcc
SOURCES = src/c/dc.cpp
POST_JS = src/js/post.js

DIST   := dist
HTDOCS := htdocs

BUILD_DIR    = build
BUILD_JS_DIR = ${BUILD_DIR}/js

EMFLAGS = -s EXPORTED_FUNCTIONS="['_two_times']" --post-js $(POST_JS)

.PHONY: all clean distclean 
all:: js

${BUILD_JS_DIR}:
	mkdir -p ${BUILD_JS_DIR}

js: ${BUILD_JS_DIR}
	$(EMCC) $(EMFLAGS) $(SOURCES) -o ${BUILD_JS_DIR}/dc.js

${HTDOCS}: js
	mkdir -p ${HTDOCS}
	cp ${BUILD_JS_DIR}/dc.js ${HTDOCS}
	cp test/html/test.html ${HTDOCS}

server : ${HTDOCS}
	cd ${HTDOCS} && python -m SimpleHTTPServer 8000


clean:: 
	-rm -rf ${BUILD_DIR} ${HTDOCS}

distclean:: clean
	-rm -rf ${DIST}
