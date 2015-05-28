EMCC = emcc
SOURCES = src/c/dc.cpp
POST_JS = src/js/post.js


DIST      = dist
HTDOCS    = htdocs
BUILD_DIR = build
CERTS_DIR = certs

BUILD_JS_DIR  = ${BUILD_DIR}/js
BUILD_BIN_DIR = ${BUILD_DIR}/bin


MESSAGE_HEADDERS_DIR = ${BUILD_DIR}/message_headders
MESSAGE_HEADDERS     = ${MESSAGE_HEADDERS_DIR}/data_tile.h

MESSAGE_JSON = src/convexstruct/dc.json

EMFLAGS = -s SAFE_HEAP=1 -s EXPORTED_FUNCTIONS="[ '_readValue', '_readTime', '_initIterator', '_nextValue', '_finishIterator']" --post-js $(POST_JS) -std=c++11 -I${MESSAGE_HEADDERS_DIR}

.PHONY: all clean distclean 
all:: js

${BUILD_JS_DIR}:
	mkdir -p ${BUILD_JS_DIR}

messages : ${MESSAGE_HEADDERS}

js: ${BUILD_JS_DIR} ${MESSAGE_HEADDERS}
	$(EMCC) -O2 $(EMFLAGS) $(SOURCES) -o ${BUILD_JS_DIR}/dc.js

${HTDOCS}: js
	mkdir -p ${HTDOCS}
	cp ${BUILD_JS_DIR}/* ${HTDOCS}
	cp test/html/* ${HTDOCS}
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx1.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx2.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx3.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx4.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx5.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx6.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx7.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx8.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx9.out
	cp ${HTDOCS}/rx.out ${HTDOCS}/rx10.out

${MESSAGE_HEADDERS_DIR}:
	mkdir -p ${MESSAGE_HEADDERS_DIR}

${MESSAGE_HEADDERS} : ${MESSAGE_HEADDERS_DIR}
	messagebuilder c ${MESSAGE_JSON} | cat -s > ${MESSAGE_HEADDERS}
	astyle --delete-empty-lines --break-blocks --break-closing-brackets ${MESSAGE_HEADDERS}

${BUILD_BIN_DIR}:
	mkdir -p ${BUILD_BIN_DIR}

server : ${HTDOCS}
	nghttpd -n 4 --htdocs=${HTDOCS}/ 8000 ${CERTS_DIR}/server.key ${CERTS_DIR}/server.crt

buildtile: ${BUILD_BIN_DIR} ${MESSAGE_HEADDERS}
	CGO_CFLAGS="-I/home/moore/devel/planet/data-commander/build/message_headders/ -std=c99" go build -o ${BUILD_BIN_DIR}/buildtile src/go/planet.com/dc/build_tile.go

${CERTS_DIR}:
	mkdir -p ${CERTS_DIR}

gennreate_certs: ${CERTS_DIR}
	openssl genrsa -out ${CERTS_DIR}/rootCA.key 2048
	openssl req -x509 -new -nodes -key ${CERTS_DIR}/rootCA.key -days 1024 -out ${CERTS_DIR}/rootCA.pem
	openssl genrsa -out ${CERTS_DIR}/server.key 2048
	openssl req -new -key ${CERTS_DIR}/server.key -out ${CERTS_DIR}/server.csr
	openssl x509 -req -in ${CERTS_DIR}/server.csr -CA ${CERTS_DIR}/rootCA.pem -CAkey ${CERTS_DIR}/rootCA.key -CAcreateserial -out ${CERTS_DIR}/server.crt -days 500

clean:: 
	-rm -rf ${BUILD_DIR} ${HTDOCS}

distclean:: clean
	-rm -rf ${DIST}
	-rm -rf ${CERTS_DIR}
