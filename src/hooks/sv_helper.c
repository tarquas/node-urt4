#include <server/server.h>

cvar_t *urt4_cvarFind(const char *name);

const char *urt4_cvarGet2(cvar_t *var) {
	return var->string;
}

const char *urt4_cvarGet(const char *name) {
	cvar_t *var = urt4_cvarFind(name);
	return var ? var->string : NULL;
}

int urt4_comSvRunningGet(void) {
	return com_sv_running->integer;
}
