#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/tcp.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

#include <urt4.h>
#include <api.h>

// API.C

#define LOCALHOST "127.0.0.1"

#define EXIT_ERR_ARGS 9
#define EXIT_ERR_SOCKET 10
#define EXIT_ERR_HOST 11
#define EXIT_ERR_PORT 12
#define EXIT_ERR_FCNTL 13
#define EXIT_ERR_SETSOCKOPT 14
#define EXIT_ERR_OVERFLOW 15
#define EXIT_ERR_CONNECT 16
#define ERR_DISABLED 17

#define BUFLEN 10000000

Api_Exec *Api_execs = NULL;

void Api_exec_def(void) {
  Api_addModExec(Api_exec_sv);
  Api_addModExec(Api_exec_com);
}

int apiPort = 0;
int apiSocket = 0;

socklen_t apiSocketAddrLen = sizeof(struct sockaddr_in);
struct sockaddr_in apiSocketAddr, apiSocketAddrBind;
char apiSocketIn[BUFLEN], *apiSocketInPtr = apiSocketIn, *apiCmd = apiSocketIn;
char apiSocketOut[BUFLEN], *apiSocketOutPtr = apiSocketOut;
int apiSocketInAvail = BUFLEN, apiSocketOutAvail = BUFLEN;

int apiSocketAddrInit(
  struct sockaddr_in *apiSocketAddr,
  char *host,
  unsigned short port
) {
  memset((char *) apiSocketAddr, 0, sizeof(struct sockaddr_in));
  apiSocketAddr->sin_family = AF_INET;
  apiSocketAddr->sin_port = htons(port);
  if (!apiSocketAddr->sin_port) return EXIT_ERR_PORT;
  if (inet_aton(host, &apiSocketAddr->sin_addr) == 0) return EXIT_ERR_HOST;
  return 0;
}

int apiSocketInit(void) {
  if (apiSocket) {
    close(apiSocket);
  }

  int flags, buflen = BUFLEN;
  if ((apiSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) == -1) return EXIT_ERR_SOCKET;
  flags = fcntl(apiSocket, F_GETFL, 0);
  if (flags == -1) return EXIT_ERR_FCNTL;
  if (fcntl(apiSocket, F_SETFL, flags | O_NONBLOCK) == -1) return EXIT_ERR_FCNTL;

  if (setsockopt(apiSocket, SOL_SOCKET, SO_RCVBUF, &buflen, sizeof(int)) == -1) {
    return EXIT_ERR_SETSOCKOPT;
  }

  if (setsockopt(apiSocket, SOL_SOCKET, SO_SNDBUF, &buflen, sizeof(int)) == -1) {
    return EXIT_ERR_SETSOCKOPT;
  }

  int one = 1;

  if (setsockopt(apiSocket, IPPROTO_TCP, TCP_NODELAY, (void *)&one, sizeof(one)) == -1) {
    return EXIT_ERR_SETSOCKOPT;    
  }

  if (connect(
    apiSocket,
    (struct sockaddr *) &apiSocketAddr, sizeof(struct sockaddr_in)
  ) == -1) {
    if (errno != EINPROGRESS) return EXIT_ERR_CONNECT;
  }

  return 0;
}

int apiConnect2(void) {
  int code = connect(apiSocket, (struct sockaddr *) &apiSocketAddr, sizeof(struct sockaddr_in));
  if (!code) return 0;
  if (errno != EALREADY && errno != EISCONN) return errno;
  return 0;
}

int apiConnect(void) {
  int code = apiConnect2();
  if (code == ECONNREFUSED) code = apiConnect2();
  return code;
}

int apiSend(const char* cmd, size_t size) {
  if (!apiPort) return ERR_DISABLED;
  int code = apiConnect();
  if (code) return code;
  if (!size) size = strlen(cmd) + 1;

  int sent = 0;

  while (sent < size) {
    sent = sendto(
      apiSocket,
      (void *) cmd, size,
      MSG_NOSIGNAL,
      (struct sockaddr *) &apiSocketAddr, sizeof(apiSocketAddr)
    );

    if (sent < 0) return errno;
    size -= sent;
    cmd += sent;
  }

  return 0;
}

int main(int argc, char** argv) {
  int code;
  signal(SIGPIPE, SIG_IGN);

  // emit API only if launched with args: <apiPort> . <...engine args>
  apiPort = argc < 3 || memcmp(argv[2], ".", 2) ? 0 : atoi(argv[1]);

  if (apiPort) {
    code = apiSocketAddrInit(&apiSocketAddr, LOCALHOST, apiPort);
    if (code) return code;
    argc -= 2;
    argv += 2;
    code = apiSocketInit();
    if (code) return code;
    *apiSocketIn = 0;
    Api_exec_def();
  }

  code = launchMain(argc, argv);

  if (apiSocket) close(apiSocket);
  return code;
}

int Api_send(const char* cmd) {
  return apiSend(cmd, 0);
}

void Api_exec(long long rpcId, const char* cmd) {
  Api_Exec *exec = Api_execs;
  while (exec && !exec->cb(rpcId, cmd)) exec = exec->next;
}

void Api_addModExec(Api_ExecCb cb) {
  Api_Exec *exec = (Api_Exec *) malloc(sizeof(Api_Exec));
  exec->next = Api_execs;
  exec->cb = cb;
  Api_execs = exec;
}

void Api_processInbound(void) {
  ssize_t len;
  int code = apiConnect();
  //printf("api %d\n", code);
  if (code) return;

  len = recv(apiSocket, apiSocketInPtr, apiSocketInAvail, 0);

  if (!len) {
    apiSocketInit();
    return;
  }

  if (len < 0) return;

  apiSocketInPtr += len;
  apiSocketInAvail -= len;

  if (apiSocketInPtr[-1]) return;
  char *acmd, *cmd;

  for (acmd = apiCmd; acmd < apiSocketInPtr; acmd += len) {
    len = strlen(acmd) + 1;
    cmd = acmd;

    if (!memcmp(cmd, "api id\0", 6)) {
      char pid[64];
      int len;

      snprintf(pid, 64, "api id %d %s %s%n",
        getpid(),
        urt4_cvarGet("net_port"),
        urt4_cvarGet("sv_hostname"),
        &len
      );

      apiSend(pid, len + 1);
      continue;
    }

    if (!memcmp(cmd, "api kill ", 9)) {
      int pid = atoi(cmd + 9);

      if (pid == getpid()) {
        urt4_doInput("quit\n");
        apiSend(cmd, 0);
        continue;
      }
    }

    long long rpcId = 0;
    int n;

    if (!memcmp(cmd, "rpc ", 4)) {
      cmd += 4;
      sscanf(cmd, "%lld%n", &rpcId, &n);
      cmd += n + 1;
    }

    Api_exec(rpcId, cmd);
  }

  apiSocketInPtr = apiSocketIn;
  apiSocketInAvail = BUFLEN;
}
