### NodeUrt4 Makefile

### Set it up if anything is not default on your side:

NODE=node
NPM=npm
GIT=git

### Values below are linked to standards or external settings. Better not to modify them:

IOQ3_REPO=https://github.com/mickael9/ioq3.git
Q3UT4_HUB=tarquas-urt.storage.googleapis.com
Q3UT4_DL=https://$(Q3UT4_HUB)/node-urt4/q3ut4-minified.zip
Q3UT4_AR=q3ut4.zip
Q3UT4_MAPS_FUN_1_DL=https://$(Q3UT4_HUB)/node-urt4/nodeurt4-fun-pack-1.zip
Q3UT4_MAPS_FUN_1_AR=nodeurt4-fun-pack-1.zip
Q3UT4_MAPS_JUMP_1_DL=https://$(Q3UT4_HUB)/node-urt4/nodeurt4-jump-pack-1.zip
Q3UT4_MAPS_JUMP_1_AR=nodeurt4-jump-pack-1.zip

IOQ3_DIR=$(CURDIR)/ioq3
Q3UT4_DIR=$(CURDIR)/q3ut4
TMP_DIR=$(CURDIR)/tmp
LIB_OUT_BASENAME=urt4-api-server
LIB_OUT_EXTNAME=run
LIB_OUT_DIR=$(CURDIR)/lib
LIB_OUT_DIR_DEBUG=$(CURDIR)/lib-debug
LIB_BUILD_DIR=$(CURDIR)/build/liburt4
LIB_BUILD_DIR_DEBUG=$(CURDIR)/build/liburt4-debug
COMMON_INCLUDE_DIR=$(CURDIR)/include
HOOKS_DIR=$(CURDIR)/src/hooks
HOOKS_INJECT_HEADER=hooks_inject.h
NPM_DEPS=$(CURDIR)/node_modules

### Below are computed values:

LIB_BUILD_DIR_PATH=$(shell readlink -f $(LIB_BUILD_DIR))
LIB_BUILD_DIR_DEBUG_PATH=$(shell readlink -f $(LIB_BUILD_DIR_DEBUG))

GYPEXEC=$(shell which $(GYP) 2>/dev/null)
ifeq ($(GYPEXEC),)
GYP=$(shell $(NPM) help|grep -E '^npm@[0-9.]+ \S+' | grep -oE '\S+$$')/node_modules/node-gyp/bin/node-gyp.js
endif

CCHOOK= $$(SERVER_CFLAGS) $$(OPTIMIZE) -DFILE_$$(shell echo $$< | sed -r "s/.*\/(\w+)\..*/\1/g")
CFLAGS=" -fPIC -I code -I\"$(HOOKS_DIR)\" -include \"$(HOOKS_INJECT_HEADER)\" "
LDFLAGS=" -DDEDICATED -I\"$(COMMON_INCLUDE_DIR)\" \"$(HOOKS_DIR)/\"*.c "
BUILDSPEC=BUILD_CLIENT=0 BUILD_SERVER=1

### Targets:

release: lib-release

debug: lib-debug

run: run-prepare release
	@ $(NODE) .

run-debug-motd:
	@echo ""
	@echo "===================================="
	@echo "Debugging NODE with INSPECT: Open URL \"chrome://inspect\" in Chrome."
	@echo "Debugging C with GDB:"
	@echo "  * Send '~pid' <ENTER> command to controller's process STDIN;"
	@echo "  * Open another terminal and command 'gdb - <PID>' <ENTER>,"
	@echo "      where <PID> is first number from '~pid' reply;"
	@echo "  * command "c" to continue running;"
	@echo "  * command "q" to detach the debugger."
	@echo "===================================="
	@echo ""
	@echo "NOTES:"
	@echo "* To skip this message in future, use \"make run-debug-now\"."
	@echo "* To break node debugger before app start, use \"make run-debug-brk\", then:"
	@echo "  * press \"start\" in Chrome inspector to start application."
	@echo ""
	@echo "Press ENTER to start application in debug mode"
	@echo ""
	@read dummy

run-debug: run-debug-motd run-debug-now

run-prepare: install-q3ut4
	@ $(NPM) up

run-debug-now-old: run-prepare debug
	@ NODE_TARGET=debug \
		LD_LIBRARY_PATH="$(LIB_OUT_DIR_DEBUG):$$LD_LIBRARY_PATH" \
		gdb -q -ex "set follow-fork-mode child" -ex "run" -ex "thread apply all bt" -ex "quit" \
		--args $(NODE) --inspect .

run-debug-now: run-prepare debug
	@ NODE_TARGET=debug $(NODE) --inspect .

run-debug-brk: run-prepare debug
	@ NODE_TARGET=debug $(NODE) --inspect-brk .

clean:
	rm -rf build/
	rm -rf $(LIB_OUT_DIR_DEBUG)/
	rm -rf $(LIB_OUT_DIR)/*.d

clean-all: clean
	rm -rf $(LIB_OUT_DIR)/
	rm -rf $(IOQ3_DIR)
	rm -rf $(Q3UT4_DIR)
	rm -rf $(NPM_DEPS)

install-ioq3:
	@if [ ! "$$(grep -E '\#define\s+BASEGAME\s+\"q3ut4\"' \
		'$(IOQ3_DIR)/code/qcommon/q_shared.h' 2>/dev/null)" \
	]; then \
		if [ -d "$(IOQ3_DIR)" ]; then rm -rf "$(IOQ3_DIR)" ; fi ; \
		$(GIT) clone --depth 1 "$(IOQ3_REPO)" "$(IOQ3_DIR)" ; \
	fi

install-q3ut4:
	@if [ ! -f "$(Q3UT4_DIR)/zUrT"* ]; then \
		if [ ! -f "$(Q3UT4_AR)" ]; then wget -O "$(Q3UT4_AR)" "$(Q3UT4_DL)"; fi ; \
		unzip "$(Q3UT4_AR)"; \
		rm "$(Q3UT4_AR)"; \
	fi

installmaps-fun-1: install-q3ut4
	@if [ ! -f "$(Q3UT4_MAPS_FUN_1_AR)" ]; then wget -O "$(Q3UT4_MAPS_FUN_1_AR)" "$(Q3UT4_MAPS_FUN_1_DL)"; fi
	@unzip -o "$(Q3UT4_MAPS_FUN_1_AR)"
	@rm "$(Q3UT4_MAPS_FUN_1_AR)"

installmaps-jump-1: install-q3ut4
	@if [ ! -f "$(Q3UT4_MAPS_JUMP_1_AR)" ]; then wget -O "$(Q3UT4_MAPS_JUMP_1_AR)" "$(Q3UT4_MAPS_JUMP_1_DL)"; fi
	@unzip -o "$(Q3UT4_MAPS_JUMP_1_AR)"
	@rm "$(Q3UT4_MAPS_JUMP_1_AR)"

_build-prepare: install-ioq3
	@mkdir -p "$(LIB_BUILD_DIR_CUR)"
	@rm -f "$(LIB_BUILD_DIR_CUR)/$(LIB_OUT_BASENAME)".*

build-prepare-release: LIB_BUILD_DIR_CUR := $(LIB_BUILD_DIR)
build-prepare-release: _build-prepare

build-prepare-debug: LIB_BUILD_DIR_CUR := $(LIB_BUILD_DIR_DEBUG)
build-prepare-debug: _build-prepare

_lib-copy:
	@mkdir -p "$(LIB_OUT_DIR_CUR)"
	@cp "$(LIB_BUILD_DIR_CUR)/$(LIB_OUT_BASENAME)".* "$(LIB_OUT_DIR_CUR)"

lib-release-copy: LIB_OUT_DIR_CUR := $(LIB_OUT_DIR)
lib-release-copy: LIB_BUILD_DIR_CUR := $(LIB_BUILD_DIR)
lib-release-copy: _lib-copy

lib-debug-copy: LIB_OUT_DIR_CUR := $(LIB_OUT_DIR_DEBUG)
lib-debug-copy: LIB_BUILD_DIR_CUR := $(LIB_BUILD_DIR_DEBUG)
lib-debug-copy: _lib-copy

lib-release: lib-release-build lib-release-copy

lib-debug: lib-debug-build lib-debug-copy

lib-release-build: build-prepare-release
	@( cd $(IOQ3_DIR) && CFLAGS=$(CFLAGS) LDFLAGS=$(LDFLAGS) \
		$(MAKE) --eval 'CC+=$(CCHOOK)' release \
		$(BUILDSPEC) SERVERBIN=$(LIB_OUT_BASENAME) FULLBINEXT=.$(LIB_OUT_EXTNAME) \
		BR="$(LIB_BUILD_DIR_PATH)" )

lib-debug-build: build-prepare-debug
	@( cd $(IOQ3_DIR) && CFLAGS=$(CFLAGS) LDFLAGS=$(LDFLAGS) \
		$(MAKE) --eval 'CC+=$(CCHOOK)' debug \
		$(BUILDSPEC) SERVERBIN=$(LIB_OUT_BASENAME) FULLBINEXT=.$(LIB_OUT_EXTNAME) \
		BD="$(LIB_BUILD_DIR_DEBUG_PATH)" )

install-service:
	@echo TODO 

remove-service:
	@echo TODO 

.PHONY: \
	_build-prepare build-prepare-release build-prepare-debug \
	lib-release lib-debug \
	lib-release-build lib-debug-build \
	_lib-copy lib-release-copy lib-debug-copy \
	release debug clean clean-all run-debug-now-old \
	run-prepare run run-debug run-debug-motd run-debug-now run-debug-brk \
	install-ioq3 install-q3ut4 installmaps-fun-1 installmaps-jump-1 \
	install-service remove-service
