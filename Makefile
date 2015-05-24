EMCC = emcc
SOURCES = src/c/dc.cpp
POST_JS = src/js/post.js
CAPNP_DIR = src/capnp

DIST   := dist
HTDOCS := htdocs

BUILD_DIR       = build
BUILD_JS_DIR    = ${BUILD_DIR}/js
BUILD_CAPNP_DIR = ${BUILD_DIR}/capnp

EMFLAGS = -s EXPORTED_FUNCTIONS="['_two_times']" --post-js $(POST_JS)

.PHONY: all clean distclean 
all:: js

${BUILD_JS_DIR}:
	mkdir -p ${BUILD_JS_DIR}

${BUILD_CAPNP_DIR}:
	mkdir -p ${BUILD_CAPNP_DIR}

capnp : ${BUILD_CAPNP_DIR}
	capnp -I ${CAPNP_DIR} compile -oc++:${BUILD_CAPNP_DIR} --src-prefix=src/capnp/ src/capnp/dc.capnp

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
