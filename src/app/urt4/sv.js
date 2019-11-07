const {Emitter} = require('clasync');

class Sv extends Emitter {
  async data(cmd) {
    const [, clBegin] = cmd.match(this.$.rxBegin) || [];

    if (clBegin) {
      this.emit('begin', {client: clBegin | 0});
      return;
    }

    const [, cfgId, cfgValue] = cmd.match(this.$.rxCfg) || [];

    if (cfgId) {
      this.emit('cfg', {index: cfgId | 0, value: cfgValue});
      return;
    }

    const [, clCmdClient, clCmdOk, clCmd] = cmd.match(this.$.rxClCmd) || [];

    if (clCmdClient) {
      let o = {cmd: clCmd, ok: clCmdOk | 0, client: clCmdClient | 0}, e = this.emit('clcmd', o);
      e = e && e.then ? await e : e;
      if (!e) this.urt4.cmd(`sv clcmd ${o.client | 0} ${o.ok | 0} ${o.cmd}`);
      return;
    }

    const [, dropA, dropAReason, dropAMessage] = cmd.match(this.$.rxDropAuth) || [];

    if (dropA) {
      let o = {client: dropA | 0, reason: dropAReason, message: dropAMessage, by: 'auth'};
      let e = this.emit('drop', o);
      e = e && e.then ? await e : e;
      if (!e) this.urt4.cmd(`sv authdrop ${o.client | 0} ${o.reason}\n${o.message}`);
      return;
    }

    const [, drop, dropReason] = cmd.match(this.$.rxDrop) || [];

    if (drop) {
      let o = {client: drop | 0, reason: dropReason}, e = this.emit('drop', o);
      e = e && e.then ? await e : e;
      if (!e) this.urt4.cmd(`sv drop ${o.client | 0} ${o.reason}`);
      return;
    }

    const [, entId, entState] = cmd.match(this.$.rxEnt) || [];

    if (entId) {
      this.emit('ent', {id: entId | 0, state: entState});
      return;
    }

    const [, infoClient, infoString] = cmd.match(this.$.rxInfo) || [];

    if (infoClient) {
      this.emit('info', {client: infoClient | 0, info: infoString});
      return;
    }

    const [, psSlot, psState] = cmd.match(this.$.rxPs) || [];

    if (psSlot) {
      this.emit('ps', {client: psSlot | 0, state: psState});
      return;
    }

    const [, mapKillBots, mapName] = cmd.match(this.$.rxMap) || [];

    if (mapKillBots) {
      this.emit('map', {killBots: mapKillBots | 0, map: mapName});
      return;
    }

    const [, svCmdClient, svCmd] = cmd.match(this.$.rxSvCmd) || [];

    if (svCmdClient) {
      let o = {cmd: svCmd, client: svCmdClient | 0};
      let e = this.emit('svcmd', o);
      e = e && e.then ? await e : e;
      if (!e) this.urt4.cmd(`sv svcmd ${o.client | 0} ${o.cmd}`);
      return;
    }
  }
}

Sv.rxBegin = /^sv begin (\d+)$/;
Sv.rxCfg = /^sv cfg (\d+) ([\S\s]*)$/;
Sv.rxClCmd = /^sv clcmd (\d+) (\d+) ([\S\s]*)$/;
Sv.rxDropAuth = /^sv authdrop (\d+) (.*)\n([\S\s]*)$/;
Sv.rxDrop = /^sv drop (\d+) ([\S\s]*)$/;
Sv.rxEnt = /^sv ent (\d+) ([\S\s]*)$/;
Sv.rxInfo = /^sv info (\d+) ([\S\s]*)$/;
Sv.rxMap = /^sv map (\d+) ([\S\s]*)$/;
Sv.rxPs = /^sv ps (\d+) ([\S\s]*)$/;
Sv.rxSvCmd = /^sv svcmd ([\d-]+) ([\S\s]*)$/;

module.exports = Sv;
