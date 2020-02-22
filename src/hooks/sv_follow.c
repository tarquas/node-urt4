#include <urt4.h>
#include <api.h>

#include <server/server.h>

#include <sv_follow.h>

//

SvFollow_Ent svFollow_ents[MAX_GENTITIES];

//

/*void svFollow_compileAng(float a[3], struct quat *q) {
  struct vec ang = mkvec(radians(a[1]), radians(a[2]), radians(a[0]));
  *q = rpy2quat(ang);
}*/

void svFollow_compile(SvFollow_Coords *ent) {
  struct vec ang = mkvec(radians(ent->ang[2]), radians(ent->ang[0]), radians(ent->ang[1]));
  struct vec torq = mkvec(radians(ent->torq[2]), radians(ent->torq[0]), radians(ent->torq[1]));
  ent->c.pos.x = ent->pos[0];
  ent->c.pos.y = ent->pos[1];
  ent->c.pos.z = ent->pos[2];
  ent->c.velo.x = ent->velo[0];
  ent->c.velo.y = ent->velo[1];
  ent->c.velo.z = ent->velo[2];
  ent->c.ang = rpy2quat(ang);
  ent->c.torq = rpy2quat(torq);
}

void svFollow_fetch(SvFollow_Coords *ent) {
  struct vec ang = quat2rpy(ent->c.ang);
  struct vec torq = quat2rpy(ent->c.torq);
  ent->pos[0] = ent->c.pos.x;
  ent->pos[1] = ent->c.pos.y;
  ent->pos[2] = ent->c.pos.z;
  ent->velo[0] = ent->c.velo.x;
  ent->velo[1] = ent->c.velo.y;
  ent->velo[2] = ent->c.velo.z;
  ent->ang[0] = degrees(ang.y);
  ent->ang[1] = degrees(ang.z);
  ent->ang[2] = degrees(ang.x);
  ent->torq[0] = degrees(torq.y);
  ent->torq[1] = degrees(torq.z);
  ent->torq[2] = degrees(torq.x);
}

void svFollow_transform(SvFollow_Compiled *from, SvFollow_Compiled *to, SvFollow_Compiled *res) {
  // from - parent.abs, to - child.rel, res - child.abs
  res->pos = qvrot(from->ang, to->pos);
  res->pos.x += from->pos.x;
  res->pos.y += from->pos.y;
  res->pos.z += from->pos.z;
  res->velo = qvrot(from->ang, to->velo);
  res->velo.x += from->velo.x;
  res->velo.y += from->velo.y;
  res->velo.z += from->velo.z;
  res->ang = qqmul(to->ang, from->ang);
  res->torq = qqmul(to->torq, from->torq); // TODO: torque transform
}

// interface

SvFollow_Ent* svFollow_get(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  return ent;
}

void svFollow_reset(void) {
  int i;
  SvFollow_Ent *ent = svFollow_ents;

  for (i = 0; i < MAX_GENTITIES; i++, ent++) {
    ent->parent = ent->child = ent->next = -1;
    ent->dirty = 0;
  }
}

SvFollow_Ent* svFollow_setRelation(int child, int parent) {
  if (child < 0 || parent == child) return 0;
  SvFollow_Ent *entp, *entc = &svFollow_ents[child];
  if (entc->parent == parent) return entc;

  if (entc->parent >= 0) {
    // detach
    if (entc->prev >= 0) svFollow_ents[entc->prev].next = entc->next;
    else svFollow_ents[entc->parent].child = entc->next;
    if (entc->next >= 0) svFollow_ents[entc->next].prev = entc->prev;
    if (parent < 0) entc->parent = entc->prev = entc->next = -1;
  }

  if (parent >= 0) {
    // attach
    entp = &svFollow_ents[parent];
    entc->parent = parent;
    entc->next = entp->child;
    entc->prev = -1;
    if (entp->child >= 0) svFollow_ents[entp->child].prev = child;
    entp->child = child;
  }

  return entc;
}

void svFollow_setCoords(SvFollow_Ent *ent, float pos[3], float ang[3]) {
  memcpy(ent->rel.pos, pos, 3 * sizeof(float));
  memcpy(ent->rel.ang, ang, 3 * sizeof(float));
  memset(ent->rel.velo, 0, 3 * sizeof(float));
  memset(ent->rel.torq, 0, 3 * sizeof(float));
  svFollow_compile(&ent->rel);
}

SvFollow_Ent* svFollow_fromReal(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  playerState_t *ps;
  sharedEntity_t *es;

  es = SV_GentityNum(idx);

  if (idx < MAX_CLIENTS) {
    // player state
    ps = SV_GameClientNum(idx);

    memcpy(ent->abs.pos, ps->origin, sizeof(ent->abs.pos));
    memcpy(ent->abs.ang, ps->viewangles, sizeof(ent->abs.ang));
    memcpy(ent->abs.velo, ps->velocity, sizeof(ent->abs.velo));

    ent->abs.pos[2] += ps->viewheight;
  } else {
    // entity state
    memcpy(ent->abs.pos, es->s.pos.trBase, sizeof(ent->abs.pos));
    memcpy(ent->abs.ang, es->s.apos.trBase, sizeof(ent->abs.ang));
    memcpy(ent->abs.velo, es->s.pos.trDelta, sizeof(ent->abs.velo));
  }

  memcpy(ent->abs.torq, es->s.apos.trDelta, sizeof(ent->abs.torq));

  svFollow_compile(&ent->abs);
  return ent;
}

SvFollow_Ent* svFollow_toReal(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  playerState_t *ps;
  sharedEntity_t *es;
  int i, j;
  float pos[3];

  svFollow_fetch(&ent->abs);

  es = SV_GentityNum(idx);

  memcpy(pos, ent->abs.pos, sizeof(pos));

  if (idx < MAX_CLIENTS) {
    // player state
    ps = SV_GameClientNum(idx);
    pos[2] -= ps->viewheight;
		memcpy(ps->origin, pos, sizeof(pos));
    memcpy(ps->viewangles, ent->abs.ang, sizeof(ent->abs.ang));
    memcpy(ps->velocity, ent->abs.velo, sizeof(ent->abs.velo));

    client_t *cl = &svs.clients[idx];

    for (i = 0; i < 3; i++) {
      j = ANGLE2SHORT(ps->viewangles[i]);
      if (!i) j -= 11;
      ps->delta_angles[i] = j - cl->lastUsercmd.angles[i];
    }
  }

  es->s.pos.trType = es->s.apos.trType = 1;
  es->s.pos.trTime = es->s.apos.trTime = 0;
  es->s.pos.trDuration = es->s.apos.trDuration = 0;
  memcpy(es->r.currentOrigin, pos, sizeof(pos));
  memcpy(es->r.currentAngles, ent->abs.ang, sizeof(ent->abs.ang));
  memcpy(es->s.pos.trBase, pos, sizeof(pos));
  memcpy(es->s.apos.trBase, ent->abs.ang, sizeof(ent->abs.ang));
  memcpy(es->s.pos.trDelta, ent->abs.velo, sizeof(ent->abs.velo));
  memcpy(es->s.apos.trDelta, ent->abs.torq, sizeof(ent->abs.torq));

  return ent;
}

void svFollow_update(SvFollow_Ent *ent) {
  if (ent->parent < 0) return;
  SvFollow_Ent *entp = &svFollow_ents[ent->parent];
  svFollow_transform(&entp->abs.c, &ent->rel.c, &ent->abs.c);
}

void svFollow_processTree(int idx) {
  int i;
  SvFollow_Ent *ent, *next;

  ent = &svFollow_ents[idx];

  /*i = ent->parent;

  if (i >= 0) {
    next = &svFollow_ents[i];
    if (next->dirty) return;
  }*/

  svFollow_fromReal(idx);
  ent->dirty = 0;

  i = ent->child;

  while (i >= 0) {
    next = &svFollow_ents[i];
    svFollow_update(next);
    svFollow_toReal(i);
    svFollow_processTree(i);
    i = next->next;
  }
}
