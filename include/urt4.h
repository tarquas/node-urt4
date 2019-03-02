#ifndef __URT4_H
#define __URT4_H
#ifdef __cplusplus
extern "C" {
#endif

// URT4.H

#include "urt4_helper.h"

// ***** fs

	int Api_exec_fs(long long rpcId, const char *cmd);

// ***** server

	int Api_exec_sv(long long rpcId, const char *cmd);
	void urt4_doClientCommand(int slot, const char* msg, int ok);
	void urt4_doUserinfoChange(int slot, const char* info);
	void apiSetPlayerState(int slot, const char *state);
	void apiGetPlayerState(const char *pfx, int client);
	int hkCmpPlayerState(void *ps1, void *ps2);
	void apiSetEntityState(int num, const char *state);
	void apiGetEntityState(const char *pfx, int num);
	int hkCmpEntityState(void *es1, void *es2);
	void apiFindEntities(const char *pfx, int from, const char *state, void *p1, void *p2);

// ***** sys

	int launchMain(int argc, char **argv);

// ***** qcommon

	int Api_exec_com(long long rpcId, const char *cmd);
	void urt4_doCvar(const char *name, const char *value, int force);
	const char *urt4_cvarGet(const char *name);
	void urt4_doFsRestart(void);
	void urt4_doInput(const char* cmd);
	void urt4_doOutput(const char* text);

//

#ifdef __cplusplus
}
#endif
#endif
