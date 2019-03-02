#pragma once
#ifndef __HOOKS_INHJECT_H
#define __HOOKS_INHJECT_H
#ifdef __cplusplus
extern "C" {
#endif

// HOOKS_INJECT.H

#include "hooks_helper.h"

// ***** sv

	#ifdef FILE_sv_client
		struct client_s;
		struct usercmd_s;
		Urt4_Hook(void, SV_Auth_DropClient, (struct client_s *drop, const char *reason, const char *message));
		Urt4_Hook(void, SV_ClientEnterWorld, (struct client_s *client, struct usercmd_s *cmd));
		Urt4_Hook(void, SV_ClientThink, (struct client_s *cl, struct usercmd_s *cmd));
		Urt4_Hook(void, SV_DropClient, (struct client_s *drop, const char *reason));
		Urt4_Hook2(void, SV_ExecuteClientCommand, (struct client_s *cl, const char *s, int clientOK));
		Urt4_Hook(void, SV_UserinfoChanged, (struct client_s *cl));
	#endif

	#ifdef FILE_sv_init
		Urt4_Hook(void, SV_SetConfigstring, (int index, const char *val));
		Urt4_Hook(void, SV_Shutdown, (char *finalmsg));
		Urt4_Hook2(void, SV_SpawnServer, (char *server, int killBots));
	#endif

	#ifdef FILE_sv_main
		#include <qcommon/q_platform.h>
		#define Sys_Sleep REM
		struct client_s;
		Urt4_Hook(void, SV_Frame, (int msec));

		Urt4_Hook(
			__attribute__ ((format (printf, 2, 3))) void QDECL,
			SV_SendServerCommand,
			(struct client_s *cl, const char *fmt, ...)
		);
	#endif

	#ifdef FILE_sv_snapshot
		Urt4_Hook(void, SV_SendClientMessages, (void));
	#endif

// ***** sys

	#ifdef FILE_unix_main
		#define main urt4_launchMain
	#endif

	#ifdef FILE_sys_main
		#define main urt4_launchMain
		Urt4_Hook(void, Sys_SigHandler, (int signal));
		Urt4_Hook(void, Sys_Error, (const char *error, ...));
		Urt4_Hook(void, Sys_InitPIDFile, (const char *gamedir));
	#endif

	#ifdef FILE_sys_unix
		Urt4_Hook(void, Sys_PlatformExit, (void));
	#endif

	#ifdef FILE_sys_win32
		Urt4_Hook(void, Sys_PlatformExit, (void));
	#endif

// ***** qcommon

	#ifdef FILE_cmd
		//Urt4_Hook(void, Cbuf_AddText, (const char *text));
		Urt4_Hook(void, Cmd_ExecuteString, (const char *text));
	#endif

	#ifdef FILE_cm_load
		Urt4_Hook2(void, CMod_LoadBrushes, (void *l));
		Urt4_Hook2(void, CMod_LoadPatches, (void *surfs, void *verts));
		Urt4_Hook2(void, CMod_LoadShaders, (void *l));
	#endif

	#ifdef FILE_common
		#include <qcommon/q_platform.h>

		Urt4_Hook(
			__attribute__ ((format (printf, 1, 2))) void QDECL,
			Com_Printf,
			(const char *fmt, ...)
		);

		Urt4_Hook(void, Com_Init, (char *commandLine));
		Urt4_Hook(void, Com_WriteConfiguration, (void));
	#endif

	#ifdef FILE_cvar
		struct cvar_s;
		static struct cvar_s *Cvar_FindVar( const char *var_name );
		struct cvar_s *urt4_cvarFind(const char *name) { return Cvar_FindVar(name); }
		Urt4_Hook(struct cvar_s *, Cvar_Get, (const char *var_name, const char *var_value, int flags));

		Urt4_Hook2(struct cvar_s *, Cvar_Set2,
			(const char *var_name, const char *value, int force)
		);
	#endif

	#ifdef FILE_files
		struct cvar_s;
		Urt4_ExposeStatic(int, fs_checksumFeed);
		Urt4_ExposeStatic(struct cvar_s *, fs_basepath);
		Urt4_Hook2(int, FS_FOpenFileByMode, (const char *qpath, int *f, int mode));
		Urt4_Hook2(int, FS_Write, (const void *buffer, int len, int h));
		Urt4_Hook2(void, FS_FCloseFile, (int f));
		Urt4_Hook(void, FS_Restart, (int checksumFeed));
		Urt4_Hook(const char *, FS_LoadedPakNames, (void));
		Urt4_Hook(const char *, FS_LoadedPakChecksums, (void));
		Urt4_Hook(const char *, FS_LoadedPakPureChecksums, (void));
		Urt4_Hook(const char *, FS_ReferencedPakNames, (void));
		Urt4_Hook(const char *, FS_ReferencedPakChecksums, (void));
		Urt4_Hook(const char *, FS_ReferencedPakPureChecksums, (void));
		Urt4_Hook(void, FS_AddGameDirectory, (const char *path, const char *dir));
		Urt4_Hook(char *, FS_BuildOSPath, (const char *base, const char *game, const char *qpath));
	#endif

	#ifdef FILE_md4
		Urt4_Hook(unsigned, Com_BlockChecksum, (const void *buffer, int length));
	#endif

// *****

#ifdef __cplusplus
}
#endif
#endif
