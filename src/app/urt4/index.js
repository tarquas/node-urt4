const {$} = require('clasync');

const Com = require('./com');
const Sv = require('./sv');
const Sys = require('./sys');
const Info = require('./info');
const Admin = require('../admin');

class Urt4 extends $ {
  static get type() { return 'urt4'; };

  async init(deps) {
    this.app.urt4s[this.id] = this;

    await deps({
      com: Com.new(),
      sv: Sv.new(),
      sys: Sys.new()
    });

    this.port = 0;
    this.pid = 0;
    this.msgBuf = [];
    this.rpcById = {};
    this.rpcIdNext = 1;

    this.clients = {};
    this.game = {};
    this.round = {};

    this.socket.on('error', this.error.bind(this));
    this.socket.on('data', this.data.bind(this));

    this.cmd('api id');

    await deps({
      admin: Admin.new(),
      $info: Info.new()
    });
  }

  async error() {
  }

  getBoolean(s) {
    if (!s) return 0;
    if (s | 0) return 1;
    const l = s.toString().trim().toLowerCase();
    if (l == 'true' || l == 'on' || l == 'yes' || l == '+') return 1;
    return 0;
  }

  showBoolean(b) {
    return b ? 'ON' : 'OFF';
  }

  getTimeSpan(s) {
    const ents = (s || '').toString().toLowerCase().match(this.$.rxParseTimeSpan);
    if (!ents) return 0;
    let msec = 0;

    for (const ent of ents) {
      const l = ent.length - 1;
      const n = +ent.substr(0, l);

      switch (ent.charAt(l)) {
        case 'w': msec += n * 604800000; break;
        case 'd': msec += n * 86400000; break;
        case 'h': msec += n * 3600000; break;
        case 'm': msec += n * 60000; break;
        case 's': msec += n * 1000; break;
        default: msec += (+ent || 0) * 1000; break;
      }
    }

    return msec;
  }

  showTimeSpan(msec) {
    let m = parseInt(msec) || 0;
    const ents = [];
    const weeks = parseInt(m / 604800000);
    if (weeks) { ents.push(`${weeks} weeks`); m -= weeks * 604800000; }
    const days = parseInt(m / 86400000);
    if (days) { ents.push(`${days} days`); m -= days * 86400000; }
    const hours = parseInt(m / 3600000);
    if (hours) { ents.push(`${hours} hours`); m -= hours * 3600000; }
    const min = parseInt(m / 60000);
    if (min) { ents.push(`${min} min`); m -= min * 60000; }
    const sec = parseInt(m / 1000);
    if (sec || !ents.length) ents.push(`${sec} sec`);
    return ents.join(' ');
  }

  getMask(s, masks) {
    if (!s) return 0;
    let n = parseInt(s);
    if (!isNaN(n)) return n;
    const ents = s.toString().toLowerCase().split(/\W+/);
    n = 0;

    for (const ent of ents) {
      let m = parseInt(ent);
      if (isNaN(m)) m = masks[ent];
      n |= m;
    }

    return n;
  }

  showMask(n, maskNames, sep) {
    let bin = n;
    let d = 1;
    let ents = [];

    for (; bin; bin >>= 1, d <<= 1) {
      if (!(bin & 1)) continue;
      console.log(d, maskNames[d]);
      ents.push(maskNames[d] || `0x${d.toString(16)}`);
    }

    if (!ents.length) return maskNames[0] || '0';
    return ents.join(sep || '+');
  }

  getValueByType(value, type) {
    switch (type) {
      case Boolean: return this.getBoolean(value);
      case 'int32': case 'hex': return value | 0;
      case Number: return +value || 0;
      case String: return value;
      default: return type(value, false);
    }
  }

  typeName(type) {
    switch (type) {
      case Boolean: return 'ON | OFF';
      case 'int32': case Number: case 'hex': return 'Number';
      case String: return 'String';
      default: return type.typeName || type.name;
    }
  }

  showValueByType(value, type) {
    switch (type) {
      case Boolean: return this.showBoolean(value);
      case 'int32': case Number: return (value || 0).toString();
      case 'hex': return `0x${(value || 0).toString(16)}`;
      case String: return (value || '').toString();
      default: return type(value, true);
    }
  }

  cmd(line) {
    this.socket.write(`${line}\0`);
  }

  cmds(lines) {
    this.socket.write(this.$.mapArray(lines, line => `${line}\0`).join(''));
  }

  clientCfg(client, cfgId, value) {
    if (value.length <= this.$.cfgMaxLength) return [`sv svcmd ${client} cs ${cfgId} "${value}"`];

    const parts = value.match(this.$.cfgMaxLengthRx);
    const result = [`sv svcmd ${client} bcs0 ${cfgId} "${parts[0]}"`];
    const l = parts.length - 1;
    for (let idx = 1; idx < l; idx++) result.push(`sv svcmd ${client} bcs1 ${cfgId} "${parts[idx]}"`);
    result.push(`sv svcmd ${client} bcs2 ${cfgId} "${parts[l]}"`);
    return result;
  }

  async rpc(cmd) {
    const rpcId = this.rpcIdNext++;

    const promise = new Promise((resolve) => {
      this.rpcById[rpcId] = resolve;
    });

    this.socket.write(`rpc ${rpcId} ${cmd}\0`);

    const result = await this.$.race([
      promise,
      this.$.timeout(5000, new Error(`timeout @ ${cmd}`))
    ]);

    delete this.rpcById[rpcId];
    return result;
  }

  async rpcs(cmds) {
    const rpcObjs = cmds.map(cmd => ({rpcId: this.rpcIdNext++, cmd}));

    const promises = rpcObjs.map(obj => (
      new Promise((resolve) => {
        this.rpcById[obj.rpcId] = resolve;
      })
    ));

    const msg = rpcObjs.map(obj => `rpc ${obj.rpcId} ${obj.cmd}\0`).join('');
    this.socket.write(msg);

    const result = await this.$.race([
      this.$.all(promises),
      this.$.timeout(5000, new Error(`timeout @ ${cmds.join('; ')}`))
    ]);

    rpcObjs.forEach(obj => delete this.rpcById[obj.rpcId]);
    return result;
  }

  noColor(s) {
    const s1 = (s || '').toString().replace(this.$.rxColor, '');
    return s1;
  }

  getDesc() {
    return `#${this.id}: PID ${this.pid} @ UDP port ${this.port} : ${this.noColor(this.name)}`;
  }

  log(s, ...args) {
    console.log(`#${this.id}: ${s}`, ...args);
  }

  normText(s) {
    const nfd = (s || '').toString().normalize('NFD').replace(this.$.rxModChars, '');
    return nfd;
  }

  async data(message) {
    if (this[this.$.instance].final) return;
    const socket = this.socket;
    if (!message.length) return;
    this.msgBuf.push(message);

    if (!message[message.length - 1]) {
      const cmds = this.msgBuf.join('').split('\0');
      this.msgBuf.length = 0;

      for (const cmd of cmds) {
        if (!cmd) continue;

        switch (cmd.substr(0, 3)) {
          case 'api': {
            const [, pid, port, name] = cmd.match(/^api id (\d+) (\d+) ([\S\s]*)$/) || [];

            if (pid) {
              Object.assign(this, {pid, port, name});
              console.log(`*** attached Urt4 server ${this.getDesc()}`);
              const urt4 = this.app.urt4s[this.app.curUrt4Id];
              if (!urt4) this.app.switchToServer(this.id);
            }
          }; break;

          case 'com': {
            await this.com.data(cmd);
          }; break;

          case 'rpc': {
            const [, rpcIdS, , out] = cmd.match(/^rpc (\d+)( ([\S\s]*))?$/) || [];

            if (rpcIdS) {
              const rpcId = +rpcIdS;

              if (!rpcId) {
                this.log(out == null ? '(null)' : out);
              } else {
                const rpc = this.rpcById[rpcId];

                if (rpc) {
                  rpc(out);
                  delete this.rpcById[rpcId];
                }
              }
            }
          }; break;

          case 'sv ': {
            await this.sv.data(cmd);
          }; break;

          case 'sys': {
            await this.sys.data(cmd);
          }; break;
        }
      }
    }
  }

  async sendCmd(sCmd) {
    const cmd = /\n$/.test(sCmd) ? sCmd.substr(0, sCmd.length - 1) : sCmd;

    if (/^~/.test(cmd)) {
      const [pidCmd] = cmd.match(/^~pid\s/) || [];
      if (pidCmd) return this.log(`~pid: ${this.pid || 'unknown'} @ UDP port: ${this.port || 'unknown'}`);

      const [, rpcCmd] = cmd.match(/^~in\s+(.*)/) || [];
      if (rpcCmd) return this.cmd(`com in ${rpcCmd}`);

      const [cvarEchoMatch, , cvarEchoOn] = cmd.match(/^~cvar(\s+(\S*))?$/) || [];

      if (cvarEchoMatch) {
        if (!cvarEchoOn) return this.log(`~cvar: echo is ${this.showBoolean(this.cvarEcho)}`);
        this.cvarEcho = this.getBoolean(cvarEchoOn);
        return this.log(`~cvar: echo changed to ${this.showBoolean(this.cvarEcho)}`);
      }

      const [, cvarName, cvarValue] =
        cmd.match(/^~cvar\s+(\S+)\s([\S\s]*)$/) || [];
      if (cvarName) {
        return this.cmd(`com cvar 1 ${cvarName} ${cvarValue}`);
      }

      const [, echoOn] = cmd.match(/^~echo\s(\S*)/) || [];

      if (echoOn != null) {
        if (!echoOn) return this.log(`~echo: is ${this.showBoolean(this.echo)}`);
        this.echo = this.getBoolean(echoOn);
        return this.log(`~echo: changed to ${this.showBoolean(this.echo)}`);
      }

      const [, actOn] = cmd.match(/^~act\s(\S*)/) || [];

      if (actOn != null) {
        if (!actOn) return this.log(`~act: is ${this.showBoolean(this.act)}`);
        this.act = this.getBoolean(actOn);
        return this.log(`~act: changed to ${this.showBoolean(this.act)}`);
      }

      const [, cfgOn] = cmd.match(/^~cfg\s(\S*)/) || [];

      if (cfgOn != null) {
        if (!cfgOn) return this.log(`~cfg: is ${this.showBoolean(this.cfgOn)}`);
        this.cfgOn = this.getBoolean(cfgOn);
        return this.log(`~cfg: changed to ${this.showBoolean(this.cfgOn)}`);
      }

      const [, rawCmd] = cmd.match(/^~raw\s(.*)/) || [];
      if (rawCmd != null) return this.cmd(rawCmd);

      const [, rawsCmd] = cmd.match(/^~((com|sv|sys) (.*))/) || [];
      if (rawsCmd != null) return this.cmd(rawsCmd);

      const [, rawNCmd] = cmd.match(/^~rawn\s([\S\s]*)$/) || [];
      if (rawNCmd != null) return this.cmd(rawNCmd);
    }

    const cmdIn = await this.com.emit('in', {cmd});
    if (cmdIn) return;
    return this.cmd(`rpc 0 com rpc ${cmd}`);
  }

  async final() {
    delete this.app.urt4s[this.id];
  }
}

Urt4.cfgMaxLength = 900;
Urt4.cfgMaxLengthRx = new RegExp(`.{1,${Urt4.cfgMaxLength}}`, 'g');

Urt4.rxColor1 = /\^(.)/;
Urt4.rxColor = /\^(.)/g;
Urt4.rxModChars = /[\u0300-\u036f]/g;
Urt4.rxParseTimeSpan = /\d+[smhdw]?/g;

module.exports = Urt4;
