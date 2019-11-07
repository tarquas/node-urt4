#include <urt4.h>
#include <api.h>

#include <server/server.h>

#include "math3d.h"

//

SvFollow_Ent svFollow_ents[MAX_GENTITIES];

//

void svFollow_compile(SvFollow_Coords *ent) {
  struct vec ang = mkvec(ent->ang[0], ent->ang[1], ent->ang[2]);
  ent->c.pos.x = ent->pos[0];
  ent->c.pos.y = ent->pos[1];
  ent->c.pos.z = ent->pos[2];
  ent->c.ang = rpy2quat(ang);
}

void svFollow_fetch(SvFollow_Coords *ent) {
  struct vec tmp = quat2rpy(ent->c.ang);
  ent->pos[0] = ent->c.pos.x;
  ent->pos[1] = ent->c.pos.y;
  ent->pos[2] = ent->c.pos.z;
  ent->ang[0] = tmp.x;
  ent->ang[1] = tmp.y;
  ent->ang[2] = tmp.z;
}

void svFollow_transform(SvFollow_Compiled *from, SvFollow_Compiled *to, SvFollow_Compiled *res) {
  // from - parent.abs, to - child.rel, res - child.abs
  res->pos = qvrot(from->ang, to->pos);
  res->pos.x += from->pos.x;
  res->pos.y += from->pos.y;
  res->pos.z += from->pos.z;
  res->ang = qqmul(from->ang, to->ang);
}

// interface

SvFollow_Ent* svFollow_get(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  return ent;
}

void svFollow_reset(void) {
  int i;
  SvFollow_Ent *ent = svFollow_ents;
  for (i = 0; i < MAX_GENTITIES; i++, ent++) ent->parent = ent->child = ent->next = -1;
}

SvFollow_Ent* svFollow_setRelation(int child, int parent) {
  if (child < 0) return;
  SvFollow_Ent *entp, *entc = &svFollow_ents[child];

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
    if (entp->child >= 0) svFollow_ents[entp->child]->prev = child;
    entp->child = child;
  }

  return entc;
}

void svFollow_setCoords(SvFollow_Ent *ent, float pos[3], float ang[3]) {
  ent->rel.pos = pos;
  ent->rel.ang = ang;
  svFollow_compile(&ent->rel);
}

SvFollow_Ent* svFollow_fromReal(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  playerState_t *ps;
  sharedEntity_t *es;

  if (idx < 64) {
    // player state
    ps = SV_GameClientNum(idx);
		ent->abs.pos = ps->origin;
    ent->abs.ang = ps->viewangles;
    ent->abs.pos[2] += ps->viewheight;
  } else {
    // entity state
    es = SV_GentityNum(idx);
		ent->abs.pos = es->r.currentOrigin;
    ent->abs.ang = es->r.currentAngles;
  }

  svFollow_compile(ent->abs);
  return ent;
}

SvFollow_Ent* svFollow_toReal(int idx) {
  SvFollow_Ent *ent = &svFollow_ents[idx];
  playerState_t *ps;
  sharedEntity_t *es;
  int i, j;

  svFollow_fetch(ent->abs);

  if (idx < 64) {
    // player state
    ps = SV_GameClientNum(idx);
		ps->origin = ent->abs.pos;
    ps->origin[2] -= ps->viewheight;
    ps->viewangles = ent->abs.ang;

    for (i = 0; i < 3; i++) {
      j = ANGLE2SHORT(ps->viewangles[i]);
      ps->delta_angles[i] = j - cl->lastUsercmd.angles[i];
    }
  } else {
    // entity state
    es = SV_GentityNum(idx);
		es->r.currentOrigin = ent->abs.pos;
    es->r.currentAngles = ent->abs.ang;
  }

  return ent;
}

void svFollow_update(SvFollow_Ent *ent) {
  if (ent->parent < 0) return;
  SvFollow_Ent *entp = svFollow_ents[ent->parent];
  svFollow_transform(&entp->abs.c, &ent->rel.c, &ent->abs.c);
}
