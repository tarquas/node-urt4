#include <urt4.h>
#include <api.h>

#include <server/server.h>

// SV.C

// ClientCommand

Urt4_Hook(void, SV_ExecuteClientCommand, (client_t *cl, const char *s, qboolean clientOK)) {
	/*if (!memcmp(s, "cp ", 3)) {
		urt4_SV_ExecuteClientCommand(cl, s, clientOK);
		return;
	}*/

	char msg2[strlen(s) + 30];
	snprintf(msg2, sizeof(msg2), "sv clcmd %ld %d %s", cl - svs.clients, (int) clientOK, s);

	if (Api_send(msg2)) {
		urt4_SV_ExecuteClientCommand(cl, s, clientOK);
	}
}

void urt4_doClientCommand(int slot, const char* msg, int ok) {
	if (slot < 0 || slot >= 64) return;
	client_t *cl = &svs.clients[slot];
	if (cl->state < CS_CONNECTED) return;
	urt4_SV_ExecuteClientCommand(cl, msg, (qboolean) ok);
}

// ClientThink

void SV_GhostThink(client_t *cl) {
	int               i;
	int               num;
	int               touch[MAX_GENTITIES];
	static float      rads[] = {35.0f, 35.0f, 100.0f};
	vec3_t            mins, maxs;
	sharedEntity_t    *ent;
	sharedEntity_t    *oth;
	playerState_t *ps;

	if (sv_gametype->integer != 9) return;

	ps = SV_GameClientNum((int)(cl - svs.clients));
	if (ps->persistant[PERS_TEAM] == 3) return;

	ent = SV_GentityNum((int)(cl - svs.clients));

	for (i = 0; i < 3; i++) {
		mins[i] = ent->r.currentOrigin[i] - rads[i];
		maxs[i] = ent->r.currentOrigin[i] + rads[i];
	}

	num = SV_AreaEntities(mins, maxs, touch, MAX_GENTITIES);

	for (i = 0; i < num; i++) {
		if (touch[i] < 0 || touch[i] >= sv_maxclients->integer) continue;
		oth = SV_GentityNum(touch[i]);
		if (ent->s.number == oth->s.number) continue;
		ent->r.contents &= ~CONTENTS_BODY;
		ent->r.contents |= CONTENTS_CORPSE;
		return;
	}

	ent->r.contents &= ~CONTENTS_CORPSE;
	ent->r.contents |= CONTENTS_BODY;
}

Urt4_Hook(void, SV_ClientThink, (client_t *cl, usercmd_t *cmd)) {
	if (cl->state == CS_ACTIVE) {
		SV_GhostThink(cl);
	}

	urt4_SV_ClientThink(cl, cmd);
}

// Configstring

Urt4_Hook(void, SV_SetConfigstring, (int index, const char *val)) {
	char msg2[strlen(val) + 30];
	snprintf(msg2, sizeof(msg2), "sv cfg %d %s", index, val);
	urt4_SV_SetConfigstring(index, val);
	Api_send(msg2);
}

// Drop Client

Urt4_Hook(void, SV_Auth_DropClient, (client_t *drop, const char *reason, const char *message)) {
	char msg2[strlen(reason) + strlen(message) + 30];
	snprintf(msg2, sizeof(msg2), "sv authdrop %ld %s\n%s", drop - svs.clients, reason, message);

	if (Api_send(msg2)) {
		urt4_SV_Auth_DropClient(drop, reason, message);
	}
}

Urt4_Hook(void, SV_DropClient, (client_t *drop, const char *reason)) {
	char msg2[strlen(reason) + 30];
	snprintf(msg2, sizeof(msg2), "sv drop %ld %s", drop - svs.clients, reason);

	if (Api_send(msg2)) {
		urt4_SV_DropClient(drop, reason);
	}
}

// EnterWorld

Urt4_Hook(void, SV_ClientEnterWorld, (struct client_s *client, struct usercmd_s *cmd)) {
	char msg2[30];
	snprintf(msg2, sizeof(msg2), "sv begin %ld", client - svs.clients);
	urt4_SV_ClientEnterWorld(client, cmd);
	Api_send(msg2);
}

// Frame

int urt4_comSvRunningGet(void);

int hkPlayersWasPrev = 0;
int hkGentsWasPrev = 0;

char hkClientsPrev[MAX_CLIENTS];
playerState_t hkPlayersPrev[MAX_CLIENTS];
char hkPlayersDirty[MAX_GENTITIES];

char hkHasGentsPrev[MAX_GENTITIES];
sharedEntity_t hkGentsPrev[MAX_GENTITIES];
char hkGentsDirty[MAX_GENTITIES];

void hkProcessPlayers(void) {
	int i;
	playerState_t *ps;
	char pfx[65536];

	if (!hkPlayersWasPrev) {
		for (i = 0; i < MAX_CLIENTS; i++) {
			ps = SV_GameClientNum(i);

			if (ps) {
				memcpy(&hkPlayersPrev[i], ps, sizeof(playerState_t));
				hkClientsPrev[i] = 1;
			} else {
				hkClientsPrev[i] = 0;
			}
		}

		hkPlayersWasPrev = 1;
	} else {
		for (i = 0; i < MAX_CLIENTS; i++) {
			ps = SV_GameClientNum(i);
			hkPlayersDirty[i] = 0;

			if (!ps ^ !hkClientsPrev[i]) {
				snprintf(pfx, 65536, "sv ps %d", i);

				if (ps) {
					memcpy(&hkPlayersPrev[i], ps, sizeof(playerState_t));
					hkClientsPrev[i] = 1;
				} else {
					hkClientsPrev[i] = 0;
				}

				apiGetPlayerState(pfx, i);
			} else if (ps) {
				if (hkCmpPlayerState(&hkPlayersPrev[i], ps)) {
					hkPlayersDirty[i] = 1;
					snprintf(pfx, 65536, "sv ps %d", i);
					memcpy(&hkPlayersPrev[i], ps, sizeof(playerState_t));
					apiGetPlayerState(pfx, i);
				}
			}
		}
	}
}

void hkProcessEntities(void) {
	int i;
	sharedEntity_t *es;
	char pfx[65536];

	if (!hkGentsWasPrev) {
		for (i = 0; i < sv.num_entities; i++) {
			es = SV_GentityNum(i);
			hkGentsDirty[i] = 0;

			if (es) {
				memcpy(&hkGentsPrev[i], es, sizeof(sharedEntity_t));
				hkHasGentsPrev[i] = 1;
			} else {
				hkHasGentsPrev[i] = 0;
			}
		}

		hkGentsWasPrev = 1;
	} else {
		for (i = 0; i < MAX_GENTITIES; i++) {
			es = SV_GentityNum(i);

			if (!es ^ !hkHasGentsPrev[i]) {
				snprintf(pfx, 65536, "sv ent %d", i);

				if (es) {
					memcpy(&hkGentsPrev[i], es, sizeof(sharedEntity_t));
					hkHasGentsPrev[i] = 1;
				} else {
					hkHasGentsPrev[i] = 0;
				}

				apiGetEntityState(pfx, i);
			} else if (es) {
				if (hkCmpEntityState(&hkGentsPrev[i], es)) {
					hkGentsDirty[i] = 1;
					snprintf(pfx, 65536, "sv ent %d", i);
					memcpy(&hkGentsPrev[i], es, sizeof(sharedEntity_t));
					apiGetEntityState(pfx, i);
				}
			}
		}
	}
}

void hkProcessFollow(void) {
}

Urt4_Hook(void, SV_Frame, (int msec)) {
	if (!urt4_comSvRunningGet()) Api_processInbound();
	urt4_SV_Frame(msec);
	hkProcessPlayers();
	hkProcessEntities();
	hkProcessFollow();
}

Urt4_Hook(void, SV_SendClientMessages, (void)) {
	if (urt4_comSvRunningGet()) Api_processInbound();
	urt4_SV_SendClientMessages();
}

// ServerCommand

Urt4_Hook(void QDECL, SV_SendServerCommand, (client_t *cl, const char *fmt, ...)) {
	va_list list;
	char		msg[4096];

	va_start(list, fmt);
	vsnprintf (msg, sizeof(msg), fmt, list);
	va_end(list);

	int slot = cl == NULL ? -1 : cl - svs.clients;
	int len = strlen(msg);

	char msg2[len + 15];
	snprintf(msg2, sizeof(msg2), "sv svcmd %d %s", slot, msg);

	if (Api_send(msg2)) {
		urt4_SV_SendServerCommand(cl, "%s", msg);
	}
}

void urt4_doServerCommand(int slot, const char* cmd) {
	if (slot >= 64) return;
	client_t *cl = slot < 0 ? NULL : &svs.clients[slot];
	if (cl && cl->state < CS_CONNECTED) return;
	urt4_SV_SendServerCommand(cl, "%s", cmd);
}

// Shutdown

Urt4_Hook(void, SV_Shutdown, (char *finalmsg)) {
	char msg2[strlen(finalmsg) + 30];
	snprintf(msg2, sizeof(msg2), "sv shut %s", finalmsg);
	Api_send(msg2);
	urt4_SV_Shutdown(finalmsg);
}

// SpawnServer

Urt4_Hook(void, SV_SpawnServer, (char *server, qboolean killBots)) {
	char msg2[strlen(server) + 30];
	snprintf(msg2, sizeof(msg2), "sv map %d %s", (int) killBots, server);
	Api_send(msg2);
	urt4_SV_SpawnServer(server, killBots);
}

// UserinfoChanged

Urt4_Hook(void, SV_UserinfoChanged, (client_t *cl)) {
	char msg2[strlen(cl->userinfo) + 20];
	snprintf(msg2, sizeof(msg2), "sv info %ld %s", cl - svs.clients, cl->userinfo);

	Api_send(msg2);
	urt4_SV_UserinfoChanged(cl);
}

void urt4_doUserinfoChange(int slot, const char* info) {
	if (slot < 0 || slot >= 64) return;
	client_t *cl = &svs.clients[slot];
	if (cl->state < CS_CONNECTED) return;
	memcpy(cl->userinfo, info, strlen(info) + 1);
	urt4_SV_UserinfoChanged(cl);
}

char *urt4_getUserinfo(int slot) {
	if (slot < 0 || slot >= 64) return NULL;
	client_t *cl = &svs.clients[slot];
	if (cl->state < CS_CONNECTED) return NULL;
	char* info = cl->userinfo;
	return info;
}

void urt4_doClientVar(int slot, const char* name, const char* value) {
	if (slot < 0 || slot >= 64) return;
	client_t *cl = &svs.clients[slot];
	if (cl->state < CS_CONNECTED) return;
	Info_SetValueForKey(cl->userinfo, name, value);
	SV_UserinfoChanged(cl);
	VM_Call(gvm, GAME_CLIENT_USERINFO_CHANGED, slot);
}

char *urt4_getClientVar(int slot, const char* name) {
	if (slot < 0 || slot >= 64) return NULL;
	client_t *cl = &svs.clients[slot];
	if (cl->state < CS_CONNECTED) return NULL;
	char* value = Info_ValueForKey(cl->userinfo, name);
	return value;
}

//

int Api_exec_sv(long long rpcId, const char *cmd) {
	if (memcmp(cmd, "sv ", 3)) return 0;
	cmd += 3;

	if (!memcmp(cmd, "authdrop ", 9)) {
		cmd += 9;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		char *value = strchr(cmd, '\n');
		*value = 0;
		urt4_SV_Auth_DropClient(&svs.clients[slot], cmd, value + 1);
		return 1;
	}

	if (!memcmp(cmd, "cfg ", 4)) {
		cmd += 4;
		int len, cfgId;
		if (sscanf(cmd, "%d%n", &cfgId, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		urt4_SV_SetConfigstring(cfgId, cmd);
		return 1;
	}

	if (!memcmp(cmd, "clcmd ", 6)) {
		cmd += 6;
		int len, slot, ok;
		if (sscanf(cmd, "%d %d%n", &slot, &ok, &len) != 2) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		urt4_doClientCommand(slot, cmd, ok);
		return 1;
	}

	if (!memcmp(cmd, "clvar ", 6)) {
		cmd += 6;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		char *value = strchr(cmd, ' ');
		*value = 0;
		urt4_doClientVar(slot, cmd, value + 1);
		return 1;
	}

	if (!memcmp(cmd, "drop ", 5)) {
		cmd += 5;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		urt4_SV_DropClient(&svs.clients[slot], cmd);
		return 1;
	}

	if (!memcmp(cmd, "ent ", 4)) {
		cmd += 4;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		apiSetEntityState(slot, cmd);
		return 1;
	}

	if (!memcmp(cmd, "findareaent ", 12)) {
		cmd += 12;
		int len, entId;
		vec3_t p1, p2;

		if(sscanf(cmd, "%d %f %f %f %f %f %f%n",
			&entId,
			&p1[0], &p1[1], &p1[2],
			&p2[0], &p2[1], &p2[2],
			&len
		) != 7) return 0;

		cmd += len;
		if (*cmd) cmd++;
		char pfx[64];
		snprintf(pfx, 64, "rpc %lld sv findent %i", rpcId, entId);
		apiFindEntities(pfx, entId, cmd, &p1, &p2);
		return 1;
	}

	if (!memcmp(cmd, "findent ", 8)) {
		cmd += 8;
		int len, entId;
		if (sscanf(cmd, "%d%n", &entId, &len) != 1) return 0;
		cmd += len;
		if (*cmd) cmd++;
		char pfx[64];
		snprintf(pfx, 64, "rpc %lld sv findent %i", rpcId, entId);
		apiFindEntities(pfx, entId, cmd, NULL, NULL);
		return 1;
	}

	if (!memcmp(cmd, "getcfg ", 7)) {
		cmd += 7;
		int len, cfgId;
		if (sscanf(cmd, "%d%n", &cfgId, &len) != 1) return 0;
		cmd += len;

		char *value = NULL;

		if (cfgId >= 0 && cfgId < CS_MAX) {
			value = sv.configstrings[cfgId];
		}

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

	if (!memcmp(cmd, "getcfgmap", 9)) {
		char msg2[1024];
		snprintf(msg2, 1024, "rpc %lld %d %d %d %d %d", rpcId,
			CS_MODELS, CS_SOUNDS, CS_PLAYERS, CS_LOCATIONS, CS_MAX);
		Api_send(msg2);
		return 1;
	}

	if (!memcmp(cmd, "getclvar ", 9)) {
		cmd += 9;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		char *value = NULL;

		if (*cmd == ' ') {
			cmd++;
			value = urt4_getClientVar(slot, cmd);
		}

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

	if (!memcmp(cmd, "getent ", 7)) {
		cmd += 7;
		int len, entId;
		if (sscanf(cmd, "%d%n", &entId, &len) != 1) return 0;
		cmd += len;
		char pfx[64];
		snprintf(pfx, 64, "rpc %lld sv", rpcId);
		apiGetEntityState(pfx, entId);
		return 1;
	}

	if (!memcmp(cmd, "getinfo ", 8)) {
		cmd += 8;
		int slot;
		if (sscanf(cmd, "%d", &slot) != 1) return 0;
		char *value = urt4_getUserinfo(slot);

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

	if (!memcmp(cmd, "getinfos", 8)) {
		char msg2[1024*1024], *p = msg2;
		int c = 1024*1024, n = 0;
		char *value;
		int slot;

		snprintf(p += n, c -= n, "rpc %lld getinfos%n", rpcId, &n);

		if (!com_sv_running->integer) {
			Api_send(msg2);
			return 1;
		}

		for (slot = 0; slot < sv_maxclients->integer; slot++) {
			value = urt4_getUserinfo(slot);

			if (value) {
				snprintf(p += n, c -= n, "\n%s%n", value, &n);
			} else {
				snprintf(p += n, c -= n, "\n%n", &n);
			}
		}

		Api_send(msg2);
		return 1;
	}

	if (!memcmp(cmd, "getps ", 6)) {
		cmd += 6;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		char pfx[64];
		snprintf(pfx, 64, "rpc %lld sv", rpcId);
		apiGetPlayerState(pfx, slot);
		return 1;
	}

	if (!memcmp(cmd, "gettimes", 8)) {
		char msg2[1024], *p = msg2;
		int c = 1024, n = 0;
		int slot, time;

		snprintf(p += n, c -= n, "rpc %lld %d%n", rpcId, svs.time, &n);

		for (slot = 0; slot < sv_maxclients->integer; slot++) {
			time = svs.clients[slot].lastConnectTime;
			snprintf(p += n, c -= n, "\n%d%n", time, &n);
		}

		Api_send(msg2);
		return 1;
	}

	if (!memcmp(cmd, "gettime2", 7)) {
		char msg2[64];
		snprintf(msg2, 64, "rpc %lld %d", rpcId, sv.time);
		Api_send(msg2);
		return 1;
	}

	if (!memcmp(cmd, "gettime", 7)) {
		char msg2[64];
		snprintf(msg2, 64, "rpc %lld %d", rpcId, svs.time);
		Api_send(msg2);
		return 1;
	}

	if (!memcmp(cmd, "info ", 5)) {
		cmd += 5;
		int len, slot;
		sscanf(cmd, "%d%n", &slot, &len);
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		urt4_doUserinfoChange(slot, cmd);
		return 1;
	}

	if (!memcmp(cmd, "ps ", 3)) {
		cmd += 3;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		apiSetPlayerState(slot, cmd);
		return 1;
	}

	if (!memcmp(cmd, "svcmd ", 6)) {
		cmd += 6;
		int len, slot;
		if (sscanf(cmd, "%d%n", &slot, &len) != 1) return 0;
		cmd += len;
		if (*cmd != ' ') return 0;
		cmd++;
		urt4_doServerCommand(slot, cmd);
		return 1;
	}

	if (!memcmp(cmd, "trace ", 6)) {
		cmd += 6;

		vec3_t start, mins, maxs, end;
		int cte, passEntityNum, contentmask, capsule;

		if (sscanf(cmd,
			"%d "
			"%f %f %f "
			"%f %f %f "

			"%f %f %f "
			"%f %f %f "

			"%d %d %d",

			&cte,
			&start[0], &start[1], &start[2],
			&end[0], &end[1], &end[2],

			&mins[0], &mins[1], &mins[2],
			&maxs[0], &maxs[1], &maxs[2],

			&passEntityNum, &contentmask, &capsule
		) != 16) return 0;

		trace_t t;

		if (cte) {
			SV_ClipToEntity(&t, start, mins, maxs, end, passEntityNum, contentmask, capsule);
		} else {
			SV_Trace(&t, start, mins, maxs, end, passEntityNum, contentmask, capsule);
		}

		char msg2[16384];

		snprintf(msg2, 16384,
			"rpc %lld "

			"%d %d "
			"%.3f "
			"%.3f %.3f %.3f "
			"%d %d %d\n"

			"%.3f %.3f %.3f "
			"%.3f "
			"%d %d",

			rpcId,

			t.allsolid, t.startsolid,
			t.fraction,
			t.endpos[0], t.endpos[1], t.endpos[2],
			t.surfaceFlags, t.contents, t.entityNum,

			t.plane.normal[0], t.plane.normal[1], t.plane.normal[2],
			t.plane.dist,
			t.plane.type, t.plane.signbits
		);

		Api_send(msg2);
		return 1;
	}

	return 0;
}

//
