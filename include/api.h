#pragma once
#ifndef __API_H
#define __API_H
#ifdef __cplusplus
extern "C" {
#endif

// API.H

  typedef int (*Api_ExecCb)(long long rpcId, const char *cmd);

  typedef struct Api_Exec_s {
    struct Api_Exec_s *next;
    Api_ExecCb cb;
  } Api_Exec;

//


//

  void Api_addModExec(Api_ExecCb cb);
  int Api_send(const char* cmd);
  void Api_processInbound(void);

//

#ifdef __cplusplus
}
#endif
#endif
