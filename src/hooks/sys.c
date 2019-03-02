#include <stdarg.h>
#include <urt4.h>
#include <api.h>

// SYS.C

Urt4_Hook(__attribute__ ((noreturn)) void, Sys_Error, (const char *error, ...)) {
	va_list list;
	va_start(list, error);
	urt4_Sys_Error(error, list);
	va_end(list);
}

Urt4_Hook(void, Sys_SigHandler, (int signal)) {
	//if (!Urt4_Emit(Signal, (signal))) {
		urt4_Sys_SigHandler(signal);
	//}
}

// Exit
Urt4_Hook(void, Sys_PlatformExit, (void)) {
	//Urt4_Emit(Exit, ());
	urt4_Sys_PlatformExit();
}

// Prevent from writing PID file

Urt4_Hook(void, Sys_InitPIDFile, (const char *gamedir)) {
	// empty
}

// launchMain

Urt4_Hook(int, launchMain, (int argc, char **argv)) {
	return urt4_launchMain(argc, argv);
}

//
