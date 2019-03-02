#ifndef __URT4HLP_H
#define __URT4HLP_H
#ifdef __cplusplus
extern "C" {
#endif

#include <stdlib.h>

// URT4HLP.H

  #pragma GCC diagnostic ignored "-Wmissing-field-initializers"

	#undef REM
	#define REM(...)

	#undef ARG_Unwrap
  #define ARG_Unwrap(...) __VA_ARGS__

	#undef Urt4
	#define Urt4(name, args) urt4_ ## name args

	#undef Urt4_Hook
	#define Urt4_Hook(type, func, args) \
		type urt4_ ## func args; \
		type func args

	#undef Urt4_On
	#define Urt4_On(type, event, args) \
		typedef type (*On ## event) args; \
		int setOn ## event(On ## event a ## event);

	#undef Urt4_Evt
	#define Urt4_Evt(event) \
		On ## event doOn ## event = NULL; \
		int setOn ## event(On ## event aOn ## event) { doOn ## event = aOn ## event; return 1; }

	#undef Urt4_Emit
	#define Urt4_Emit(event, args) (doOn ## event ? doOn ## event args : 0)

	#undef Urt4_Got
	#define Urt4_Got(type, event, args) \
		type gotOn ## event args; \
		int setedOn ## event = setOn ## event(gotOn ## event); \
		type gotOn ## event args

	#undef Urt4_GotAsync
	#define Urt4_GotAsync(type, event, args) \
		Urt4_Got(type, event, args) {  }

//

#ifdef __cplusplus
}
#endif
#endif
