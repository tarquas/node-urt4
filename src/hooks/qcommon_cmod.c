#include <urt4.h>
#include <api.h>

#include <qcommon/cm_local.h>

int shader_clip = -1;

static cvar_t *cvarCModUnleash = 0;

Urt4_Hook(void, CMod_LoadBrushes, (lump_t *l)) {
	urt4_CMod_LoadBrushes(l);
	int bri, sidei;
	cbrush_t *br;
	cbrushside_t *side;

	if (!cvarCModUnleash) cvarCModUnleash = Cvar_Get("nodeurt_cmod_unleash", "0", 0);

	// mod_unleash
	int ul_ok;

	for (bri = 0, br = cm.brushes; bri < cm.numBrushes; bri++, br++) {
		br->contents = LittleLong(br->contents);

		if (cvarCModUnleash->integer) {
			if (!(br->contents & ~CONTENTS_PLAYERCLIP & ~CONTENTS_TRANSLUCENT)) {
				ul_ok = 1;

				for (sidei = 0, side = br->sides; sidei < br->numsides; sidei++, side++) {
					if (side->surfaceFlags & SURF_LADDER) {
						ul_ok = 0;
					}
				}

				if (ul_ok) br->contents &= ~CONTENTS_PLAYERCLIP;
			}

			//TODO: fix: sky allows to fall down infinitely
			/*for (sidei = 0, side = br->sides; sidei < br->numsides; sidei++, side++) {
				if (side->surfaceFlags & SURF_SKY) {
					br->contents &= ~CONTENTS_SOLID;
					br->contents |= CONTENTS_WATER;
					side->surfaceFlags |= SURF_LADDER;
					break;
				}
			}*/
		}

		br->contents = LittleLong(br->contents);
	}
}

Urt4_Hook(void, CMod_LoadPatches, (lump_t *surfs, lump_t *verts)) {
	urt4_CMod_LoadPatches(surfs, verts);
	int patchesi;
	cPatch_t **patches;
	cPatch_t *patch;

	for (patchesi = 0, patches = cm.surfaces; patchesi < cm.numSurfaces; patchesi++, patches++) {
		patch = *patches;
		if (!patch) continue;
	}
}

Urt4_Hook(void, CMod_LoadShaders, (lump_t *l)) {
	urt4_CMod_LoadShaders(l);
	int shi;
	dshader_t *sh;

	for (shi = 0, sh = cm.shaders; shi < cm.numShaders; shi++, sh++) {
		sh->contentFlags = LittleLong(sh->contentFlags);
		sh->surfaceFlags = LittleLong(sh->surfaceFlags);
		//sh->shader
		sh->contentFlags = LittleLong(sh->contentFlags);
		sh->surfaceFlags = LittleLong(sh->surfaceFlags);
	}
}
