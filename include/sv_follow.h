#ifndef __SV_FOLLOW_H
#define __SV_FOLLOW_H
#ifdef __cplusplus
extern "C" {
#endif

// SV_FOLLOW.H

  #include <math3d.h>

  typedef struct SvFollow_CompiledS {
    struct vec pos;
    struct quat ang;
    struct vec velo;
    struct quat torq;
  } SvFollow_Compiled;

  typedef struct SvFollow_CoordsS {
    float pos[3];
    float ang[3];
    float velo[3];
    float torq[3];
    SvFollow_Compiled c;
  } SvFollow_Coords;

  typedef struct SvFollow_EntS {
    int parent;
    int prev;
    int next;
    int child;
    SvFollow_Coords abs;
    SvFollow_Coords rel;
    int dirty;
  } SvFollow_Ent;

//

  SvFollow_Ent* svFollow_get(int idx);
  void svFollow_reset(void);
  SvFollow_Ent* svFollow_setRelation(int child, int parent);
  void svFollow_setCoords(SvFollow_Ent *ent, float pos[3], float ang[3]);
  SvFollow_Ent* svFollow_fromReal(int idx);
  SvFollow_Ent* svFollow_toReal(int idx);
  void svFollow_update(SvFollow_Ent *ent);
  void svFollow_processTree(int idx);

//

#ifdef __cplusplus
}
#endif
#endif
