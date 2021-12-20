const {Emitter} = require('clasync');

class Qvm extends Emitter {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'com'),
    });

    this.com.on('out', this.onOut.bind(this));
  }

  async pfxDigit(s) {
    const a = s.match(this.$.rxArenas);
    if (a) return this.emit('arenas', {parsed: a[1]});

    const w = s.match(this.$.rxSurvivorWinner);
    if (w) return this.emit('winner', {team: w[1]});

    const i = s.match(this.$.rxWorld);
    if (i) return this.emit('world', {teams: i[1] | 0, ents: i[2] | 0});
  }

  async pfxOther(s) {
  }

  async pfx_auth(s) {
    const a = s.match(this.$.rxAuthConfirmed);
    if (a) return this.emit('auth', {client: a[2] | 0, auth: a[3], level: a[4] | 0, notor: a[5], addon: a[6]});
  }

  async pfx_Acco(s) {
    const b = s.match(this.$.rxAuthRejected);
    if (b) return this.emit('badauth', {client: b[1] | 0});
  }

  async pfx_Clie(s) {
    const b = s.match(this.$.rxClientBegin);
    if (b) return this.emit('begin', {client: b[1] | 0});

    const c = s.match(this.$.rxClientConnect);
    if (c) return this.emit('connect', {client: c[1] | 0});

    const d = s.match(this.$.rxClientDisconnect);
    if (d) return this.emit('disconnect', {client: d[1] | 0});

    const i = s.match(this.$.rxClientUserinfo);
    if (i) return this.emit('info', {client: i[1] | 0, info: i[2]});

    const a = s.match(this.$.rxClientUserinfoChanged);
    if (a) return this.emit('info2', {client: a[1] | 0, info: a[2]});

    const w = s.match(this.$.rxClientSpawn);
    if (w) return this.emit('spawn', {client: w[1] | 0});
  }

  async pfx_Exit(s) {
    if (s === this.$.sExitTimelimit) return this.emit('timelimit', {});
  }

  async pfx_Flag(s) {
    const f = s.match(this.$.rxFlag);
    if (f) return this.emit('flag', {client: f[1] | 0, event: f[2] | 0, item: f[3]});

    const r = s.match(this.$.rxFlagReturn);
    if (r) return this.emit('flag', {client: -1, event: 1, item: this.$.flagReturn[r[1]]});
  }

  async ['pfx_Hit:'](s) {
    const h = s.match(this.$.rxHit);
    if (h) return this.emit('hit', {whom: h[1] | 0, who: h[2] | 0, body: h[3] | 0, weapon: h[4] | 0});
  }

  async pfx_Hotp(s) {
    if (s === this.$.sHotpotato) return this.emit('hotpotato', {});
  }

  async pfx_Init(s) {
    const g = s.match(this.$.rxInitGame);
    if (g) return this.emit('game', {cfg: g[1]});

    const r = s.match(this.$.rxInitRound);
    if (r) return this.emit('round', {cfg: r[1]});
  }

  async pfx_Item(s) {
    const i = s.match(this.$.rxItemPick);
    if (i) return this.emit('item', {client: i[1] | 0, item: i[2]});
  }

  async pfx_Kill(s) {
    const k = s.match(this.$.rxKill);
    if (k) return this.emit('kill', {who: k[1] | 0, whom: k[2] | 0, mod: k[3] | 0});
  }

  async pfx_Matc(s) {
    const k = s.match(this.$.rxMatchStart);
    if (k) return this.emit('matchStart', {mode: k[1]});
  }

  async pfx_Shut(s) {
    if (s === this.$.sShutdown) return this.emit('shutdown', {});
  }

  async pfx_Warm(s) {
    if (s === this.$.sWarmup) return this.emit('warmup', {});
  }

  async pfx_(s) {
  }

  async onOut({text}) {
    const pfx = text.substr(0, 4);
    const method = this[`pfx_${pfx}`];

    if (method) {
      await method.call(this, text);
    } else if (this.$.rxDigit.test(pfx)) {
      await this.pfxDigit(text);
    } else {
      await this.pfxOther(text);
    }
  }
}

Qvm.flagReturn = {
  RED: 1,
  BLUE: 2,
};

Qvm.rxDigit = /^\d/;

Qvm.rxArenas = /^(\d+) arenas parsed\n/;
Qvm.rxAuthConfirmed = /^auth: user validated - name: (.*) - slot: (\d+) - login: (\w*) - level: ([-\d]+) - notoriety: (.*) - addon:\s*(.*)\n$/;
Qvm.rxAuthRejected = /^AccountKick: (\d+)/;
Qvm.rxClientConnect = /^ClientConnect: (\d+)\n/;
Qvm.rxClientDisconnect = /^ClientDisconnect: (\d+)\n/;
Qvm.rxClientBegin = /^ClientBegin: (\d+)\n/;
Qvm.rxClientUserinfo = /^ClientUserinfo: (\d+) ([\S\s]*)\n$/;
Qvm.rxClientUserinfoChanged = /^ClientUserinfoChanged: (\d+) ([\S\s]*)\n$/;
Qvm.rxClientSpawn = /^ClientSpawn: (\d+)\n/;
Qvm.sExitTimelimit = 'Exit: Timelimit hit.\n';
Qvm.rxFlag = /^Flag: (\d+) (\d+): (\w+)/;
Qvm.rxFlagReturn = /^Flag Return: (\w+)/;
Qvm.rxHit = /^Hit: (\d+) (\d+) (\d+) (\d+):/
Qvm.sHotpotato = 'Hotpotato:\n';
Qvm.rxItemPick = /^Item: (\d+) (\w+)/;
Qvm.rxKill = /^Kill: (\d+) (\d+) (\d+):/
Qvm.rxMatchStart = /^MatchStart: (.+)\n/;
Qvm.rxInitGame = /^InitGame: ([\S\s]*)\n/;
Qvm.rxInitRound = /^InitRound: ([\S\s]*)\n/;
Qvm.sShutdown = 'ShutdownGame:\n';
Qvm.rxSurvivorWinner = /^SurvivorWinner: (\w+)\n/;
Qvm.sWarmup = 'Warmup:\n';
Qvm.rxWorld = /^(\d+) teams with (\d+) entities\n/;

module.exports = Qvm;
