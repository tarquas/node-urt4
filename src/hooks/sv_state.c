#include <api.h>

#include <server/server.h>

#define STAT_HEALTH 0
#define STAT_STAMINA 9

void apiSetPlayerState(int slot, const char *state) {
	int             i;
	int             arg1, arg2;

	char cmdc;
	char cmd[256];
	int n = 0;
	char *p = (char *) state, *pcmd;

	// get the client playerstate
	playerState_t *ps = SV_GameClientNum(slot);
	if (!ps) return;

	sharedEntity_t *es = SV_GentityNum(slot);
	if (!es) return;

	client_t *cl = &svs.clients[slot];

	while (*p) {
		if (sscanf(p += n, "%s%n", cmd, &n) == EOF) break;
		pcmd = cmd;
		cmdc = *pcmd;

		while (cmdc == ' ' || cmdc == '\t' || cmdc == '\n') cmdc = *(++pcmd);

		switch (cmdc) {
			case 'a': {
				if (memcmp(cmd, "ang", 4)) break;
				sscanf(p += n, "%f %f %f%n",
					&ps->viewangles[0], &ps->viewangles[1], &ps->viewangles[2], &n);

				// set the view angles deltas
				for (i = 0; i < 3; i++) {
					arg1 = ANGLE2SHORT(ps->viewangles[i]);
					ps->delta_angles[i] = arg1 - cl->lastUsercmd.angles[i];
				}
			}; break;

			case 'c': {
				if (memcmp(cmd, "cmd", 4)) break;
				int weapon;
				sscanf(p += n, "%d %d%n",
					&cl->lastUsercmd.buttons, &weapon, &n);
				cl->lastUsercmd.weapon = (byte) weapon;
			}; break;

			case 'd': {
				if (memcmp(cmd, "dmg", 4)) break;
				sscanf(p += n, "%d %d %d%n",
					&ps->damageCount, &ps->damagePitch, &ps->damageYaw, &n);
			}; break;

			case 'i': {
				if (memcmp(cmd, "items", 6)) break;
				for (i = 0; i < MAX_WEAPONS; i++)
					sscanf(p += n, "%d%n", &ps->ammo[i], &n);
			}; break;

			case 'm': {
				if (memcmp(cmd, "motion", 7)) break;
				sscanf(p += n, "%d %d %d %d %d%n",
					&ps->pm_flags, &ps->bobCycle, &ps->movementDir,
					&ps->legsAnim, &ps->torsoAnim, &n);
				ps->legsTimer = 255;
				ps->torsoTimer = 255;
			}; break;

			case 'p': {
				switch (*(++pcmd)) {
					case 'e': {
						if (memcmp(cmd, "pers", 5)) break;

						for (i = 0; i < MAX_PERSISTANT; i++)
							sscanf(p += n, "%d%n", &ps->persistant[i], &n);
					}; break;

					case 'l': {
						if (memcmp(cmd, "player", 7)) break;
						sscanf(p += n, "%d %d %d %d %d%n",
							&ps->pm_type, &es->s.eType, &arg1, &arg2, &ps->clientNum, &n);
						if (arg1) ps->pm_flags |= 1024;
						else ps->pm_flags &= ~1024;
						cl->state = (clientState_t) arg2;
					}; break;

					case 'o': {
						if (memcmp(cmd, "pos", 4)) break;
						sscanf(p += n, "%f %f %f%n",
							&ps->origin[0], &ps->origin[1], &ps->origin[2], &n);
					}; break;
				}
			}; break;

			case 's': {
				if (memcmp(cmd, "stats", 6)) break;

				for (i = 0; i < MAX_STATS; i++)
					sscanf(p += n, "%d%n", &ps->stats[i], &n);
			}; break;

			case 'v': {
				switch (*(++pcmd)) {
					case 'e': {
						if (memcmp(cmd, "velo", 5)) break;
						sscanf(p += n, "%f %f %f%n",
							&ps->velocity[0], &ps->velocity[1], &ps->velocity[2], &n);
					}; break;

					case 'i': {
						if (memcmp(cmd, "view", 5)) break;
						sscanf(p += n, "%d%n", &ps->viewheight, &n);
					}; break;
				}
			}; break;

			case 'w': {
				if (!memcmp(cmd, "weapon", 7)) {
					sscanf(p += n, "%d %d%n", &ps->weapon, &ps->weaponstate, &n);
					break;
				}

				if (!memcmp(cmd, "weapons", 8)) {
					for (i = 0; i < MAX_POWERUPS; i++)
						sscanf(p += n, "%d%n", &ps->powerups[i], &n);
					break;
				}
			}; break;
		}
	}
}

void apiGetPlayerState(const char *pfx, int client) {
	char pl_all[655360];
	char stats[655360];
	char *pstats = stats;
	int i, c = 655360, n = 0;

	playerState_t *ps = SV_GameClientNum(client);
	sharedEntity_t *es = SV_GentityNum(client);
	client_t *cl = &svs.clients[client];

	if (client < 0 || client >= MAX_CLIENTS || !ps || !es) {
		snprintf(pl_all, sizeof(pl_all), "%s ps %d void", pfx, client);
		Api_send(pl_all);
		return;
	}

	snprintf(pstats += n, c -= n, "\nstats%n", &n);

	for (i = 0; i < MAX_STATS; i++) {
		snprintf(pstats += n, c -= n, " %d%n", ps->stats[i], &n);
	}

	snprintf(pstats += n, c -= n, "\npers%n", &n);

	for (i = 0; i < MAX_PERSISTANT; i++) {
		snprintf(pstats += n, c -= n, " %d%n", ps->persistant[i], &n);
	}

	snprintf(pstats += n, c -= n, "\nitems%n", &n);

	for (i = 0; i < MAX_WEAPONS; i++) {
		snprintf(pstats += n, c -= n, " %d%n", ps->ammo[i], &n);
	}

	snprintf(pstats += n, c -= n, "\nweapons%n", &n);

	for (i = 0; i < MAX_POWERUPS; i++) {
		snprintf(pstats += n, c -= n, " %d%n", ps->powerups[i], &n);
	}

	snprintf (pl_all, sizeof(pl_all),
		"%s ps %d"
		"\npos %0.3f %0.3f %0.3f"
		"\nang %0.3f %0.3f %0.3f"
		"\nvelo %0.3f %0.3f %0.3f"
		"\nweapon %i %i"
		"\ndmg %i %i %i"
		"\nmotion %i %i %i %i %i"
		"\nview %i"
		"\nplayer %d %d %d %d %d"
		"\nping %d"
		"\ncmd %d %d"
		"%s",
		pfx, client,
		ps->origin[0], ps->origin[1], ps->origin[2],
		ps->viewangles[0], ps->viewangles[1], ps->viewangles[2],
		ps->velocity[0], ps->velocity[1], ps->velocity[2],
		ps->weapon, ps->weaponstate,
		ps->damageCount, ps->damagePitch, ps->damageYaw,
		ps->pm_flags, ps->bobCycle, ps->movementDir, ps->legsAnim, ps->torsoAnim,
		ps->viewheight,
		ps->pm_type, es->s.eType, (ps->pm_flags & 1024) ? 1 : 0, cl->state, ps->clientNum,
		cl->ping,
		cl->lastUsercmd.buttons, cl->lastUsercmd.weapon,
		stats
	);

	Api_send(pl_all);
}

#define hkCmpPlayerStateItem(item) if (ps1->item != ps2->item) return 1

int hkCmpPlayerState(void *vps1, void *vps2) {
	playerState_t *ps1 = (playerState_t *) vps1;
	playerState_t *ps2 = (playerState_t *) vps2;
	if (memcmp(ps1->origin, ps2->origin, sizeof(ps1->origin))) return 1;
	if (memcmp(ps1->velocity, ps2->velocity, sizeof(ps1->velocity))) return 1;
	if (memcmp(ps1->viewangles, ps2->viewangles, sizeof(ps1->viewangles))) return 1;
	if (memcmp(ps1->stats, ps2->stats, sizeof(ps1->stats))) return 1;
	if (memcmp(ps1->persistant, ps2->persistant, sizeof(ps1->persistant))) return 1;
	if (memcmp(ps1->ammo, ps2->ammo, sizeof(ps1->ammo))) return 1;
	if (memcmp(ps1->powerups, ps2->powerups, sizeof(ps1->powerups))) return 1;

	hkCmpPlayerStateItem(damageCount);
	hkCmpPlayerStateItem(damagePitch);
	hkCmpPlayerStateItem(damageYaw);
	hkCmpPlayerStateItem(pm_flags);
	hkCmpPlayerStateItem(bobCycle);
	hkCmpPlayerStateItem(movementDir);
	hkCmpPlayerStateItem(legsAnim);
	hkCmpPlayerStateItem(torsoAnim);
	hkCmpPlayerStateItem(viewheight);
	hkCmpPlayerStateItem(pm_type);
	hkCmpPlayerStateItem(weapon);
	hkCmpPlayerStateItem(weaponstate);
	return 0;
}

void apiGetEntityStateUp(const char *pfx, int num, void *esv) {
	char pl_all[655360];
	unsigned l;
  sharedEntity_t *es = (sharedEntity_t *) esv;

	vec3_t *pos, *ang, *tposb, *tangb, *tposd, *tangd;

	if (num < 0 || num >= MAX_GENTITIES || !es) {  // sv.num_entities
		snprintf (pl_all, sizeof(pl_all), "%s ent %d void", pfx, num);
		Api_send(pl_all);
		return;
	}

	pos = &es->r.currentOrigin; //es->s.pos.trBase;
	ang = &es->r.currentAngles; //es->s.apos.trBase;
	tposb = &es->s.pos.trBase;
	tangb = &es->s.apos.trBase;
	tposd = &es->s.pos.trDelta;
	tangd = &es->s.apos.trDelta;
	l = (unsigned) es->s.constantLight;

	snprintf (pl_all, sizeof(pl_all),
		"%s ent %d"
		"\npos %0.3f %0.3f %0.3f"
		"\nang %0.3f %0.3f %0.3f"
		"\nmodel %i %i"
		"\nsound %i"
		"\ntype %i %i"
		"\nevent %i %i %i %i"
		"\nlink %i"
		"\nsolid %i %i"
		"\nmins %0.3f %0.3f %0.3f"
		"\nmaxs %0.3f %0.3f %0.3f"
		"\nlight %i %i %i %i"
		"\nrelate %i %i %i %i %i"
    "\nplayer %i %i %i %i"
    "\ntpos %i %i %i %0.3f %0.3f %0.3f %0.3f %0.3f %0.3f"
    "\ntang %i %i %i %0.3f %0.3f %0.3f %0.3f %0.3f %0.3f",
		pfx, num,
		(*pos)[0], (*pos)[1], (*pos)[2],
		(*ang)[0], (*ang)[1], (*ang)[2],
		es->s.modelindex, es->s.modelindex2,
		es->s.loopSound,
		es->s.eType, es->r.bmodel,
		es->r.svFlags, es->r.singleClient, es->s.event, es->s.eventParm,
		es->r.linked,
		es->r.contents, es->s.eFlags,
		es->r.mins[0], es->r.mins[1], es->r.mins[2],
		es->r.maxs[0], es->r.maxs[1], es->r.maxs[2],
		l & 0xFF, (l >> 8) & 0xFF, (l >> 16) & 0xFF, (l >> 24) & 0xFF,
		es->s.clientNum, es->s.groundEntityNum, es->s.otherEntityNum, es->s.otherEntityNum2, es->r.ownerNum,
    es->s.powerups, es->s.weapon, es->s.legsAnim, es->s.torsoAnim,
    es->s.pos.trType, es->s.pos.trTime, es->s.pos.trDuration,
      (*tposb)[0], (*tposb)[1], (*tposb)[2], (*tposd)[0], (*tposd)[1], (*tposd)[2],
    es->s.apos.trType, es->s.apos.trTime, es->s.apos.trDuration,
      (*tangb)[0], (*tangb)[1], (*tangb)[2], (*tangd)[0], (*tangd)[1], (*tangd)[2]
	);

	Api_send(pl_all);
}

void apiGetEntityState(const char *pfx, int num) {
  sharedEntity_t *es = SV_GentityNum(num);
  apiGetEntityStateUp(pfx, num, es);
}

#define hkCmpEntityStateItem(item) if (es1->item != es2->item) return 1

int hkCmpEntityState(void *ves1, void *ves2) {
	sharedEntity_t *es1 = (sharedEntity_t *) ves1;
	sharedEntity_t *es2 = (sharedEntity_t *) ves2;
	if (memcmp(es1->r.currentOrigin, es2->r.currentOrigin, sizeof(es1->r.currentOrigin))) return 1;
	if (memcmp(es1->r.currentAngles, es2->r.currentAngles, sizeof(es1->r.currentAngles))) return 1;
	if (memcmp(es1->r.mins, es2->r.mins, sizeof(es1->r.mins))) return 1;
	if (memcmp(es1->r.maxs, es2->r.maxs, sizeof(es1->r.maxs))) return 1;

	hkCmpEntityStateItem(s.modelindex);
	hkCmpEntityStateItem(s.loopSound);
	hkCmpEntityStateItem(s.eType);
	hkCmpEntityStateItem(r.bmodel);
	hkCmpEntityStateItem(r.svFlags);
	hkCmpEntityStateItem(r.singleClient);
	hkCmpEntityStateItem(s.event);
	hkCmpEntityStateItem(s.eventParm);
	hkCmpEntityStateItem(r.linked);
	hkCmpEntityStateItem(r.contents);
	hkCmpEntityStateItem(s.eFlags);
	hkCmpEntityStateItem(s.constantLight);
	hkCmpEntityStateItem(s.clientNum);
	hkCmpEntityStateItem(s.groundEntityNum);
	hkCmpEntityStateItem(s.otherEntityNum);
	hkCmpEntityStateItem(s.otherEntityNum2);
	//hkCmpEntityStateItem(s.powerups);
	//hkCmpEntityStateItem(s.weapon);
	//hkCmpEntityStateItem(s.legsAnim);
	//hkCmpEntityStateItem(s.torsoAnim);
	return 0;
}

void apiSetEntityState(int num, const char *state) {
	unsigned R, G, B, I;

	vec3_t          pos, pos2;

	char cmdc;
	char cmd[256];
	int n = 0;
	char *p = (char *) state, *pcmd;

	if (num < 0) num = sv.num_entities++;

	sharedEntity_t *es = SV_GentityNum(num);
	if (!es) return;

	es->s.number = num;

	while (*p) {
		if (sscanf(p += n, "%s%n", cmd, &n) == EOF) break;
		pcmd = cmd;
		cmdc = *pcmd;

		while (cmdc == ' ' || cmdc == '\t' || cmdc == '\n') cmdc = *(++pcmd);
//TODO: epos
		switch (cmdc) {
			case 'a': {
				if (memcmp(cmd, "ang", 4)) break;
				sscanf(p += n, "%f %f %f%n",
					&pos[0], &pos[1], &pos[2], &n);

				VectorCopy(pos, es->r.currentAngles);
				VectorCopy(pos, es->s.apos.trBase);
			}; break;

			case 'e': {
				if (memcmp(cmd, "event", 6)) break;
				sscanf(p += n, "%d %d %d %d%n",
					&es->r.svFlags, &es->r.singleClient,
					&es->s.event, &es->s.eventParm,
					&n);
			}; break;

			case 'l': {
				switch (*(pcmd += 2)) {
					case 'g': {
						if (memcmp(cmd, "light", 6)) break;
						sscanf(p += n, "%d %d %d %d%n",
							&R, &G, &B, &I, &n);
						es->s.constantLight = (int)(R | (G << 8) | (B << 16) | (I << 24));
					}; break;

					case 'n': {
						if (memcmp(cmd, "link", 5)) break;
						sscanf(p += n, "%d%n", &R, &n);

						if (R) {
							SV_LinkEntity(es);
						} else {
							SV_UnlinkEntity(es);
						}
					}; break;
				}
			}; break;

			case 'm': {
				switch (*(++pcmd)) {
					case 'a': {
						if (memcmp(cmd, "maxs", 5)) break;
						sscanf(p += n, "%f %f %f%n",
							&es->r.maxs[0], &es->r.maxs[1], &es->r.maxs[2], &n);
					}; break;

					case 'i': {
						if (memcmp(cmd, "mins", 5)) break;
						sscanf(p += n, "%f %f %f%n",
							&es->r.mins[0], &es->r.mins[1], &es->r.mins[2], &n);
					}; break;

					case 'o': {
						if (memcmp(cmd, "model", 6)) break;
						sscanf(p += n, "%d %d%n",
							&es->s.modelindex, &es->s.modelindex2, &n);
					}; break;
				}
			}; break;

			case 'p': {
				switch (*(++pcmd)) {
          case 'l': {
            if (memcmp(cmd, "player", 7)) break;
            sscanf(p += n, "%d %d %d %d%n",
              &es->s.powerups, &es->s.weapon,
              &es->s.legsAnim, &es->s.torsoAnim, &n);
          }; break;

          case 'o': {
            if (memcmp(cmd, "pos", 4)) break;
            sscanf(p += n, "%f %f %f%n",
              &pos[0], &pos[1], &pos[2], &n);

            VectorCopy(pos, es->r.currentOrigin);
            VectorCopy(pos, es->s.pos.trBase);
          }; break;
        }
			}; break;

			case 'r': {
				if (memcmp(cmd, "relate", 7)) break;
				sscanf(p += n, "%d %d %d %d%n",
					&es->s.clientNum, &es->s.groundEntityNum,
					&es->s.otherEntityNum, &es->s.otherEntityNum2, &n);
			}; break;

			case 's': {
				switch (*(pcmd += 2)) {
					case 'l': {
						if (memcmp(cmd, "solid", 6)) break;
						sscanf(p += n, "%d %d%n",
							&es->r.contents, &es->s.eFlags, &n);
					}; break;

					case 'u': {
						if (memcmp(cmd, "sound", 6)) break;
						sscanf(p += n, "%d%n",
							&es->s.loopSound, &n);
					}; break;
				}
			}; break;

			case 't': {
				switch (*(++pcmd)) {
          case 'a': {
            if (memcmp(cmd, "tang", 5)) break;
            sscanf(p += n, "%i %i %i %f %f %f %f %f %f%n",
              &R, &es->s.apos.trTime, &es->s.apos.trDuration,
              &pos[0], &pos[1], &pos[2], &pos2[0], &pos2[1], &pos2[2], &n);

            es->s.apos.trType = (trType_t) R;
            VectorCopy(pos, es->s.apos.trBase);
            VectorCopy(pos2, es->s.apos.trDelta);
          }; break;

          case 'p': {
            if (memcmp(cmd, "tpos", 5)) break;
            sscanf(p += n, "%i %i %i %f %f %f %f %f %f%n",
              &R, &es->s.pos.trTime, &es->s.pos.trDuration,
              &pos[0], &pos[1], &pos[2], &pos2[0], &pos2[1], &pos2[2], &n);

            es->s.pos.trType = (trType_t) R;
            VectorCopy(pos, es->s.pos.trBase);
            VectorCopy(pos2, es->s.pos.trDelta);
          }; break;

          case 'y': {
            if (memcmp(cmd, "type", 5)) break;
            sscanf(p += n, "%d %d%n",
              &es->s.eType, &R, &n);
            es->r.bmodel = (qboolean) R;
          }; break;
        }
			}; break;
		}
	}
}

void apiFindEntities(const char *pfx, int from, const char *state, void *vp1, void *vp2) {
	int              found[MAX_GENTITIES];
	int              touch[MAX_GENTITIES];
	int              nFound;
	int              nTouch;
	int              i, entId;
	sharedEntity_t   *es;
	vec3_t *p1, *p2;

	p1 = (vec3_t *) vp1;
	p2 = (vec3_t *) vp2;
	nFound = 0;

	if (p1 && p2) {
		nTouch = SV_AreaEntities(*p1, *p2, touch, sv.num_entities);
	} else {
		nTouch = sv.num_entities;
		for (i = 0; i < nTouch; i++) touch[i] = i;
	}

	int eType = -1, bmodel = -1, modelindex = -1, modelindex2 = -1, loopSound = -1, linked = -1;

	char cmdc;
	char cmd[256];
	int n = 0, c;
	char *p = (char *) state, *pcmd;

	while (*p) {
		if (sscanf(p += n, "%s%n", cmd, &n) == EOF) break;
		pcmd = cmd;
		cmdc = *pcmd;

		while (cmdc == ' ' || cmdc == '\t' || cmdc == '\n') cmdc = *(++pcmd);

		switch (cmdc) {
			case 't': {
				if (memcmp(cmd, "type", 5)) break;
				sscanf(p += n, "%d %d%n",
					&eType, &bmodel, &n);
			}; break;

			case 'm': {
				if (memcmp(cmd, "model", 6)) break;
				sscanf(p += n, "%d %d%n",
					&modelindex, &modelindex2, &n);
			}; break;

			case 's': {
				if (memcmp(cmd, "sound", 6)) break;
				sscanf(p += n, "%d%n",
					&loopSound, &n);
			}; break;

			case 'l': {
				if (memcmp(cmd, "link", 5)) break;
				sscanf(p += n, "%d%n",
					&linked, &n);
			}; break;
		}
	}

	for (i = 0; i < nTouch; i++) {
		entId = touch[i];
		es = SV_GentityNum(entId);
		if (!es) continue;

		if (eType != -1 && es->s.eType != eType) continue;
		if (bmodel != -1 && es->r.bmodel != bmodel) continue;
		if (modelindex != -1 && es->s.modelindex != modelindex) continue;
		if (modelindex2 != -1 && es->s.modelindex2 != modelindex2) continue;
		if (loopSound != -1 && es->s.loopSound != loopSound) continue;
		if (linked != -1 && es->r.linked != linked) continue;

		if (from < 0) {
			found[nFound++] = entId;
		} else {
			if (entId < from) continue;
			apiGetEntityState(pfx, i);
			return;
		}
	}

	if (from < 0) {
		c = strlen(pfx) + 6 * nFound;
		char msg2[c];
		p = (char *) msg2;
		n = 0;
		snprintf(p += n, c -= n, "%s%n", pfx, &n);

		for (i = 0; i < nFound; i++) {
			snprintf(p += n, c -= n, " %d%n", found[i], &n);
		}

		Api_send(msg2);
	} else {
		apiGetEntityState(pfx, -1);
	}
}

void apiSendGameState(int slot, int entSkip, const char *cfg0, const char *cfg1) {
	if (slot < 0 || slot >= sv_maxclients->integer) return;

	client_t *client = &svs.clients[slot];
	int			start;
	entityState_t	*base, nullstate;
	msg_t		msg;
	byte		msgBuffer[MAX_MSGLEN];
	const char *cfg;

	client->state = CS_PRIMED;
	client->pureAuthentic = 0;
	client->gotCP = qfalse;

	client->gamestateMessageNum = client->netchan.outgoingSequence;

	MSG_Init(&msg, msgBuffer, sizeof(msgBuffer));

	MSG_WriteLong( &msg, client->lastClientCommand );

	SV_UpdateServerCommandsToClient( client, &msg );

	MSG_WriteByte(&msg, svc_gamestate);
	MSG_WriteLong(&msg, client->reliableSequence);

	for ( start = 0 ; start < MAX_CONFIGSTRINGS ; start++ ) {
		if (!start && cfg0) cfg = cfg0;
    else if (start == 1 && cfg1) cfg = cfg1;
		else cfg = sv.configstrings[start];

		if (cfg[0]) {
			MSG_WriteByte(&msg, svc_configstring);
			MSG_WriteShort(&msg, start);
			MSG_WriteBigString(&msg, cfg);
		}
	}

	Com_Memset(&nullstate, 0, sizeof(nullstate));

  int maxEnt = entSkip ? 64 : MAX_GENTITIES;

	for (start = 0; start < maxEnt; start++) {
		base = &sv.svEntities[start].baseline;
		if (!base->number) continue;
		MSG_WriteByte(&msg, svc_baseline);
		MSG_WriteDeltaEntity(&msg, &nullstate, base, qtrue);
	}

	MSG_WriteByte(&msg, svc_EOF);
	MSG_WriteLong(&msg, client - svs.clients);
	MSG_WriteLong(&msg, sv.checksumFeed);
	SV_SendMessageToClient(&msg, client);
}
