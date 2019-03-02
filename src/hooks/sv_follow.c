#include <urt4.h>
#include <api.h>

#include <server/server.h>

#include "math3d.h"

//

typedef struct SvFollow_CompiledS {
  struct vec pos;
  struct quat ang;
} SvFollow_Compiled;

typedef struct SvFollow_CoordsS {
  float pos[3];
  float ang[3];
  SvFollow_Compiled c;
} SvFollow_Coords;

typedef struct SvFollow_EntS {
  int depth;
  int parentEnt;
  int nextEnt;
  int childEnt;
  SvFollow_Coords abs;
  SvFollow_Coords rel;
} SvFollow_Ent;

//

int svFollow_ent;
SvFollow_Ent svFollow_ents[MAX_GENTITIES];

//

void svFollow_UpdateCoords(SvFollow_Coords *ent) {
  struct vec ang = mkvec(ent->ang[0], ent->ang[1], ent->ang[2]);
  ent->c.pos.x = ent->pos[0];
  ent->c.pos.y = ent->pos[1];
  ent->c.pos.z = ent->pos[2];
  ent->c.ang = rpy2quat(ang);
}

void svFollow_Transform(SvFollow_Compiled *from, SvFollow_Compiled *to, SvFollow_Compiled *res) {
  // from - absolute, to - relative child
  res->pos = qvrot(from->ang, to->pos);
  res->pos.x += from->pos.x;
  res->pos.y += from->pos.y;
  res->pos.z += from->pos.z;
  res->ang = qqmul(from->ang, to->ang);
}

void svFollow_Get(SvFollow_Coords *ent) {
  struct vec tmp = quat2rpy(ent->c.ang);
  ent->pos[0] = ent->c.pos.x;
  ent->pos[1] = ent->c.pos.y;
  ent->pos[2] = ent->c.pos.z;
  ent->ang[0] = tmp.x;
  ent->ang[1] = tmp.y;
  ent->ang[2] = tmp.z;
}

void svFollow_zeroEnts(void) {
  int i;
  SvFollow_Ent *ent = svFollow_ents;
  svFollow_ent = -1;
  for (i = 0; i < MAX_GENTITIES; i++, ent++) ent->parentEnt = -1;
}

void svFollow_setChild(int parent, int child) {
  if (svFollow_ent) svFollow_ents[parent].nextEnt = svFollow_ent;
  svFollow_ent = parent;
  
}
