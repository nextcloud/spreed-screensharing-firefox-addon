SRC := ./extension
DIST := ./dist
ZIP := $(shell which zip)

PACKAGE_NAME := nextcloud-video-calls-screensharing
PACKAGE_VERSION := $(shell  echo `sed -rn -e 's/<em:version>(.*)<\/em:version>/\1/p' $(SRC)/install.rdf` | sed -rn -e 's/^ *//p')

build:
	rm -rf $(DIST); \
	mkdir -p $(DIST); \
	cd $(SRC); \
	find . -type f -print | $(ZIP) ../$(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION).xpi -@
