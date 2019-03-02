#pragma once
#ifndef __HOOKS_HELPER_H
#define __HOOKS_HELPER_H
#ifdef __cplusplus
extern "C" {
#endif

// HOOKS_HELPER.H

  #pragma GCC diagnostic ignored "-Wstrict-prototypes"

  #undef REM
  #define REM(...)

  #undef Urt4_Hook2
  #define Urt4_Hook2(type, func, args) \
    __attribute__((weak)) type func(); \
    __attribute__((alias(# func))) type urt4_ ## func args

  #undef Urt4_Hook
  #define Urt4_Hook(type, func, args) \
    __attribute__((weak)) type func args; \
    __attribute__((alias(# func))) type urt4_ ## func args

  #undef Urt4_ExposeStatic
  #define Urt4_ExposeStatic(type, var) \
    static type var; \
    type Urt4Get_ ## var(void) { return var; } \
    void Urt4Set_ ## var(type value) { var = value; }

//

#ifdef __cplusplus
}
#endif
#endif
