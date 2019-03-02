#include <stdio.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>

#include <urt4.h>
#include <api.h>

#include <qcommon/q_platform.h>

// QCOMMON.C

#define CSUMHEX_MAXLEN 1000000
#define PAKNAME_MAXLEN 1024

#define NAMES_FILENAME "q3ut4/pk3names.txt"
#define CSUMHEX_FILENAME "q3ut4/checksums.crc"
#define CSUMHEX_FILENAME_TMP "q3ut4/checksums.crc.tmp"

//

int acquireChecksums = 0; // set to update checksums

//

#define	BIG_INFO_STRING		8192
typedef struct cvar_s cvar_t;
extern cvar_t *com_basegame;
const char *urt4_cvarGet2(cvar_t *var);
cvar_t *urt4_cvarFind(const char *name);
int Urt4Get_fs_checksumFeed(void);
cvar_t *Urt4Get_fs_basepath(void);
//int Q_vsnprintf(char *str, size_t size, const char *format, va_list ap);
int	FS_GetFileList(const char *path, const char *extension, char *listbuf, int bufsize);
const char *Q_stristr(const char *s, const char *find);
void COM_StripExtension(const char *in, char *out, int destsize);

// Cvar

Urt4_Hook(cvar_t *, Cvar_Set2,
	(const char *var_name, const char *value, int force)
) {
	cvar_t *var = urt4_Cvar_Set2(var_name, value, force);
	char *valueset = !var ? NULL : (char *) urt4_cvarGet2(var);

	if (valueset) {
		char msg2[strlen(var_name) + strlen(valueset) + 13];
		snprintf(msg2, sizeof(msg2), "com cvar %s %s", var_name, value);
		Api_send(msg2);
	}

	return var;
}

void urt4_doCvar(const char *name, const char *value, int force) {
	urt4_Cvar_Set2(name, value, force);
}

// Set public version

Urt4_Hook(cvar_t *, Cvar_Get, (const char *var_name, const char *var_value, int flags)) {
	if (
		!memcmp(var_name, "g_bomb", 6) ||
		(!memcmp(var_name, "auth_", 5) && (
			strcmp(var_name, "auth_status")
		)) ||
		!strcmp(var_name, "dmflags") ||
		!strcmp(var_name, "com_gamename")
	) {
		flags = 0;
	}

	if (
		!strcmp(var_name, "auth_groups") ||
		!strcmp(var_name, "auth_owners")
	) {
		flags = 4;
	}

	return urt4_Cvar_Get(var_name, var_value, flags);
}

Urt4_Hook(void, Com_Init, (char *commandLine)) {
	Urt4(Com_Init, (commandLine));
	urt4_Cvar_Set2("version", "NodeUrt4", 1);
}

// Output

int rpcCapture = -1;
char *rpcLines[4096];
int rpcLinesLen[4096];
int rpcLinesLenTotal = 0;

Urt4_Hook(void QDECL, Com_Printf, (const char *fmt, ...)) {
	va_list list;
	char		msg[4096];

	va_start(list, fmt);
	vsnprintf (msg, sizeof(msg), fmt, list);
	va_end(list);

	int len = strlen(msg);

	if (rpcCapture >= 0) {
		if (rpcCapture >= sizeof(rpcLines) / sizeof(rpcLines[0])) return;
		char *rpcOut = (char *) malloc(len);
		memcpy(rpcOut, msg, len);
		rpcLinesLen[rpcCapture] = len;
		rpcLines[rpcCapture] = rpcOut;
		rpcCapture++;
		rpcLinesLenTotal += len;
		return;
	}

	char msg2[len + 9];
	snprintf(msg2, sizeof(msg2), "com out %s", msg);

	Api_send(msg2);
	urt4_doOutput(msg);
}

void urt4_doOutput(const char* text) {
	urt4_Com_Printf("%s", text);
}

// Input

Urt4_Hook(void, Cmd_ExecuteString, (const char *text)) {
	char msg2[strlen(text) + 8];
	snprintf(msg2, sizeof(msg2), "com in %s", text);

	if (Api_send(msg2)) {
		urt4_Cmd_ExecuteString(text);
	}
}

void urt4_doInput(const char* cmd) {
	urt4_Cmd_ExecuteString(cmd);
}

char *urt4_doRpc(long long rpcId, const char* cmd) {
	char *result;
	char rpcIdStr[64];
	int rpcIdStrLen;
	snprintf(rpcIdStr, sizeof(rpcIdStr), "rpc %lld %n", rpcId, &rpcIdStrLen);

	if (rpcCapture >= 0) {
		urt4_Cmd_ExecuteString(cmd);
		result = (char *) malloc(rpcIdStrLen + 1);
		memcpy(result, rpcIdStr, rpcIdStrLen + 1);
		return result;
	} else {
		rpcCapture = 0;
		urt4_Cmd_ExecuteString(cmd);
	}

	if (rpcCapture > 0) {
		int i, len;
		char *rpcOut = (char *) malloc(rpcLinesLenTotal + rpcIdStrLen + 1);
		char *rpcD = rpcOut + rpcIdStrLen, *rpcS;
		memcpy(rpcOut, rpcIdStr, rpcIdStrLen);

		for (i = 0; i < rpcCapture; i++) {
			rpcS = rpcLines[i];
			len = rpcLinesLen[i];
			memcpy(rpcD, rpcS, len);
			rpcD += len;
			free(rpcS);
		}

		*rpcD = 0;
		result = rpcOut;
	} else {
		result = (char *) malloc(rpcIdStrLen + 1);
		memcpy(result, rpcIdStr, rpcIdStrLen + 1);
	}

	rpcCapture = -1;
	rpcLinesLenTotal = 0;
	return result;
}

// File system

Urt4_Hook(void, FS_Restart, (int checksumFeed)) {
	urt4_FS_Restart(checksumFeed);
	Api_send("com fs_restart");
}

void urt4_doFsRestart(void) {
	urt4_FS_Restart(Urt4Get_fs_checksumFeed());
}

// Prevent from storing q3 configuration

Urt4_Hook(void, Com_WriteConfiguration, (void)) {
	// empty
}

// Prevent from logging

Urt4_Hook(int, FS_FOpenFileByMode, (const char *qpath, int *f, int mode)) {
	printf("FOPEN: %s\n", qpath);

	if (!strcmp(qpath, "games.log")) {
		if (f) *f = -2;
		return 0;
	}

	return urt4_FS_FOpenFileByMode(qpath, f, mode);
}

Urt4_Hook(int, FS_Write, (const void *buffer, int len, int h)) {
	if (h == -2) {
		Com_Printf("Log: %s", (char *) buffer);
		return strlen(buffer);
	}

	return urt4_FS_Write(buffer, len, h);
}

Urt4_Hook(void, FS_FCloseFile, (int f)) {
	if (f == -2) return;
	return urt4_FS_FCloseFile(f);
}

// Minified PK3 support

int inMainDir = 0;
char *fs_lastBuiltOsPath = 0;

Urt4_Hook(void, FS_AddGameDirectory, (const char *path, const char *dir)) {
	inMainDir = (
    acquireChecksums &&
    !strcmp(path, urt4_cvarGet2(Urt4Get_fs_basepath())) &&
    !strcmp(dir, urt4_cvarGet2(com_basegame))
  );

	if (inMainDir) {
		FILE *csumFile = fopen(CSUMHEX_FILENAME_TMP, "w");
		if (csumFile) fclose(csumFile);
	}

	Urt4(FS_AddGameDirectory, (path, dir));

	if (inMainDir) rename(CSUMHEX_FILENAME_TMP, CSUMHEX_FILENAME);
	fs_lastBuiltOsPath = 0;
}

Urt4_Hook(char *, FS_BuildOSPath, (const char *base, const char *game, const char *qpath)) {
	char *res = urt4_FS_BuildOSPath(base, game, qpath);
	fs_lastBuiltOsPath = res;
	return res;
}

Urt4_Hook(unsigned, Com_BlockChecksum, (const void *buffer, int length)) {
	int pure = *(int *)buffer == Urt4Get_fs_checksumFeed();
	char *name = 0;
	int exists = 0;
	char buf[1000000], *p = buf;
	unsigned char *b = (unsigned char *) buffer;
	int i, c = 1000000, n = 0, v;

	if (inMainDir) {
		name = pure ? 0 : CSUMHEX_FILENAME_TMP;
	} else {
		if (fs_lastBuiltOsPath) {
			snprintf(buf, c, "%s.crc", fs_lastBuiltOsPath);
			name = buf;
			exists = access(name, F_OK) != -1;
		}
	}

	if (exists) {
		FILE *csumFile = fopen(name, "r");
		b = (unsigned char *) p;

		if (csumFile) {
			if (pure) {
				*(int *)p = *(int *) buffer;
				p += sizeof(int);
				b += sizeof(int);
			}

			n = fread(p, 1, c, csumFile);
			while (n && p[n - 1] < '0') n--;

			for (i = 0; i < n; i += 2, b++, p += 2) {
				sscanf(p, "%02x", &v);
				*b = (unsigned char) v;
			}

			fclose(csumFile);
		}

		return urt4_Com_BlockChecksum(buf, (char *) b - buf);
	}

	if (name) {
		if (pure) b += sizeof(int);
		FILE *csumFile = fopen(name, "a+");
		for (i = 0; i < length; i++, b++) snprintf(p += n, c -= n, "%02x%n", *b, &n);

		if (csumFile) {
			fprintf(csumFile, "%s\n", buf);
			fclose(csumFile);
		}
	}

	return urt4_Com_BlockChecksum(buffer, length);
}

void AppendChecksums(const char *csums, int pure) {
	FILE *csumFile = fopen(CSUMHEX_FILENAME, "r");

	if (csumFile) {
		char *ptail = strstr(csums, " ");
		char tail[BIG_INFO_STRING];
		if (ptail) strcpy(tail, ++ptail);

		int csum, nbuf, n = 0, csumsl = ptail ? ptail - csums : strlen(csums), csumsn = 0, csumsc = BIG_INFO_STRING - csumsl;
		char buf[CSUMHEX_MAXLEN], *pbuf, block[CSUMHEX_MAXLEN / 2], *pblock;
		char *csumstail = (char *) csums + csumsl, *iblock = block;

		unsigned int b;

		if (pure) {
			*(int *)block = LittleLong(Urt4Get_fs_checksumFeed());
			iblock = block + sizeof(int);
		}

		while (!feof(csumFile)) {
			if (!fgets(buf, sizeof(buf), csumFile)) break;
			if (*buf == ';' || *buf == '#' || *buf == '\n' || *buf == ' ') continue;
			nbuf = strlen(buf);
			if (!nbuf) break;
			while (nbuf && buf[nbuf - 1] <= ' ') buf[--nbuf] = 0;
			if (!nbuf) break;
			pblock = iblock;

			for (pbuf = buf; *pbuf && *pbuf != '\n'; pbuf += n) {
				sscanf(pbuf, "%02x%n", &b, &n);
				*(pblock++) = (char) b;
			}

			csum = urt4_Com_BlockChecksum(block, pblock - block);
			snprintf(csumstail += csumsn, csumsc -= csumsn, "%d %n", csum, &csumsn);
		}

		if (ptail) {
			csumstail += csumsn;
			strcpy(csumstail, tail);
		}

		fclose(csumFile);
	}
}

void AppendNames(const char* names, int prefix) {
	FILE *nameFile = fopen(NAMES_FILENAME, "r");

	if (nameFile) {
		char *ptail = strstr(names, " ");
		char tail[BIG_INFO_STRING];
		if (ptail) strcpy(tail, ++ptail);

		int nbuf, namesl = ptail ? ptail - names : strlen(names), namesn = 0, namesc = BIG_INFO_STRING - namesl;
		char buf[PAKNAME_MAXLEN], *namestail = (char *) names + namesl;

		while (!feof(nameFile)) {
			if (!fgets(buf, sizeof(buf), nameFile)) break;
			if (*buf == ';' || *buf == '#' || *buf == '\n' || *buf == ' ') continue;
			nbuf = strlen(buf);
			if (!nbuf) break;
			while (nbuf && buf[nbuf - 1] <= ' ') buf[--nbuf] = 0;
			if (!nbuf) break;

			if (prefix) {
				snprintf(namestail += namesn, namesc -= namesn, "%s/%s %n", "q3ut4", buf, &namesn);
			} else {
				snprintf(namestail += namesn, namesc -= namesn, "%s %n", buf, &namesn);
			}
		}

		if (ptail) {
			namestail += namesn;
			strcpy(namestail, tail);
		}

		fclose(nameFile);
	}
}

Urt4_Hook(const char *, FS_LoadedPakChecksums, (void)) {
	const char *csums = Urt4(FS_LoadedPakChecksums, ());
	AppendChecksums(csums, 0);
	return csums;
}

Urt4_Hook(const char *, FS_LoadedPakPureChecksums, (void)) {
	const char *csums = Urt4(FS_LoadedPakPureChecksums, ());
	AppendChecksums(csums, 1);
	return csums;
}

Urt4_Hook(const char *, FS_LoadedPakNames, (void)) {
	const char *names = Urt4(FS_LoadedPakNames, ());
	AppendNames(names, 0);
	return names;
}

Urt4_Hook(const char *, FS_ReferencedPakNames, (void)) {
	const char *names = Urt4(FS_ReferencedPakNames, ());
	AppendNames(names, 1);
	return names;
}

Urt4_Hook(const char *, FS_ReferencedPakChecksums, (void)) {
	const char *csums = Urt4(FS_ReferencedPakChecksums, ());
	AppendChecksums(csums, 0);
	return csums;
}

Urt4_Hook(const char *, FS_ReferencedPakPureChecksums, (void)) {
	const char *csums = Urt4(FS_ReferencedPakPureChecksums, ());
	AppendChecksums(csums, 1);
	return csums;
}

//

void urt4_sendMaps(const char *pfx, const char *filter) {
	int  i;
	int  len = 0;
	int  mapNum;
	char *ptr;
	char mapList[1024*1024];
	char msg2[1024*1024], *p = msg2;
	int n = 0, c = 1024*1024;

	ptr = mapList;
	snprintf(ptr, sizeof(mapList), "%s%n", pfx, &len);
	ptr += len;

	snprintf(p += n, c -= n, "%s%n", pfx, &n);

	if (!(mapNum = FS_GetFileList("maps", ".bsp", mapList, sizeof(mapList)))) {
		Api_send(msg2);
		return;
	}

	ptr = mapList;

	for (i = 0; i < mapNum; i++, ptr += len + 1) {
		len = (int) strlen(ptr);
		COM_StripExtension(ptr, ptr, 64);

		if (!filter || !*filter || Q_stristr(ptr, filter)) {
			snprintf(p += n, c -= n, "\n%s%n", ptr, &n);
		}
	}

	Api_send(msg2);
}

//

int Api_exec_com(long long rpcId, const char *cmd) {
	if (memcmp(cmd, "com ", 4)) return 0;
	cmd += 4;

	if (!memcmp(cmd, "cvar ", 5)) {
		cmd += 5;
		int len, force;
		sscanf(cmd, "%d%n", &force, &len);
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		char *value = strchr(cmd, ' ');
		*value = 0;
		urt4_doCvar(cmd, value + 1, force);
		return 1;
	}

	if (!memcmp(cmd, "fs_restart", 7)) {
		urt4_doFsRestart();
		urt4_sendMaps("com fs_restart maps ", NULL);
    return 1;
	}

	if (!memcmp(cmd, "getcvar ", 8)) {
		cmd += 8;
		const char *value = urt4_cvarGet(cmd);

		if (value) {
			int len = strlen(value);
			char msg2[len + 22];
			snprintf(msg2, len + 22, "rpc %lld %s", rpcId, value);
			Api_send(msg2);
		} else {
			char msg2[22];
			snprintf(msg2, 22, "rpc %lld", rpcId);
			Api_send(msg2);
		}

		return 1;
	}

	if (!memcmp(cmd, "in ", 3)) {
		cmd += 3;
		urt4_doInput(cmd);
		return 1;
	}

	if (!memcmp(cmd, "getmaps ", 8)) {
		cmd += 8;

		char pfx[64];
		snprintf(pfx, 64, "rpc %lld maps %s", rpcId, cmd);

		urt4_sendMaps(pfx, cmd);
		return 1;
	}

	if (!memcmp(cmd, "out ", 4)) {
		cmd += 4;
		urt4_doOutput(cmd);
		return 1;
	}

	if (!memcmp(cmd, "rpc ", 4)) {
		cmd += 4;
		char *result = urt4_doRpc(rpcId, cmd);
		Api_send(result);
		free(result);
		return 1;
	}

	return 0;
}

//
