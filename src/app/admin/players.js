const Cmd = require('./cmd');

const config = require('../config');
const web = require('axios');

class Players extends Cmd {
  async init(deps) {
    this.clients = {};
    this.ents = {};
    this.geoip = {};

    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm')
    });

    this.$qvm.on('auth', this.onAuth.bind(this));
    this.$qvm.on('connect', this.onConnect.bind(this));
    this.$qvm.on('disconnect', this.onDisconnect.bind(this));
    this.$qvm.on('begin', this.onBegin.bind(this));
    this.$qvm.on('info', this.onInfo.bind(this));
    this.$qvm.on('info2', this.onInfo2.bind(this));
    this.sv.on('clcmd', this.onClCmd.bind(this), 1);
    this.sv.on('svcmd', this.onSvCmd.bind(this));
    this.sv.on('drop', this.onDrop.bind(this));
    this.sv.on('ent', this.onEnt.bind(this));
    this.sv.on('map', this.onMap.bind(this));
  }

  async final() {
    this.clients = {};
  }

  async getCfgMap() {
    const cfgMapStr = await this.urt4.rpc('sv getcfgmap');
    const c = this.cfgMap = {};
    [c.models, c.sounds, c.players, c.locations, c.max] = cfgMapStr.split(' ').map(v => v | 0);
  }

  async getAuthStatus() {
    this.authEngine = (await this.urt4.rpc(`com getcvar auth`)) | 0;
  }

  async onMap() {
    await this.getAuthStatus();
  }

  async initExistingClients() {
    const infosArr = await this.urt4.rpc('sv getinfos ');
    const infos = infosArr.split('\n');
    infos.shift();

    await this.$.all(infos.map(async (info, i) => {
      if (infos[i]) {
        await this.onConnect({client: i});
        await this.updateClient(i, info);
      } else {
        await this.deleteClient(i);
      }
    }));
  }

  async initClientAuths(info) {
    const allPlayers = this.$.flatten(Object.values(info.playersByTeam));

    for (const p of allPlayers) {
      await this.$qvm.emit('auth', {client: p.ID, auth: p.AUTH === '---' ? '' : p.AUTH});
    }
  }

  async set(player, settings, opts) {
    this.$db.$users.getTree(settings, player, opts);
    await this.$db.$users.update(player, settings);
  }

  async unset(player, settings, opts) {
    const o = {unset: true, ...opts};
    this.$db.$users.getTree(settings, player, o);
    await this.$db.$users.update(player, settings, o);
  }

  async wrapReason(reason, short) {
    const rule = +reason;
    if (!rule) return reason;
    const ruleArr = await this.admin.$info.getRule(rule);
    if (!ruleArr) return reason;
    const ruleText = short ? ruleArr[0] : ruleArr.join('\n');
    return ruleText;
  }

  kick(player, reason, short) {
    const c = player.client;
    const r = this.text(reason);
    const s = short ? this.text(short) : r;

    this.urt4.cmds([
      `sv svcmd ${c} disconnect ${r}`, 
      `com in kick ${c} ${s}`
    ]);

    player.dropped = {reason: 'kicked', message: short || reason, at: new Date()};
  }

  async banReason(ban, short) {
    const now = +new Date();

    const s = `^1Banned ${ban.permanent ? 'permanently' : `for ^2${
      this.urt4.showTimeSpan(ban.until - now)
    }`}^7: ${await this.wrapReason(ban.reason, short)}`;

    return s;
  }

  async onBegin({client}) {
    const player = this.clients[client];
    if (!player) return;
    const ban = player.banned;
    if (ban) this.kick(player, await this.banReason(ban), await this.banReason(ban, true));
  }

  async onAuth(info, pwd) {
    const {client, auth} = info;
    const player = this.clients[client];
    if (!player) return {error: 'noClient'};

    if (pwd) {
      const ok = await this.$db.$users.authPwd(auth, pwd);
      if (!ok) return {error: 'authFail'};
    }

    player.auth = auth;
    await this.$db.$users.getUser(player);

    const now = +new Date();
    const ban = this.$.get(player, 'punish', 'ban');

    if (ban && (ban.permanent || ban.until > now)) {
      player.banned = ban;
    }

    if (!pwd) {
      await this.set(player, this.$.makeObject(Object.entries(info).map(([k, v]) => ({
        [`authInfo.${k}`]: v
      }))));
    }

    this.emit('user', {client, player, auth});
  }

  async onInfo({client, info}) {
    await this.updateClient(client, info);
    const player = this.clients[client];
    if (!player) return;
    this.emit('info', {client, player});
  }

  async onInfo2({client, info}) {
    const player = this.clients[client];
    if (!player) return;
    player.info2 = this.getInfo(`\\${info}`);
    this.emit('info2', {client, player});
  }

  getInfo(ent) {
    const props = ent && ent.toString().match(this.$.rxUnwrapInfo);
    const obj = {};

    if (props) {
      Object.assign(obj, ...props.map((prop) => {
        const [matched, key, value] = prop.match(this.$.rxUnwrapInfoPairs) || [];
        if (!matched) return null;
        return {[key]: value};
      }));
    }

    return obj;
  }

  makeInfo(obj) {
    const arr = Object.keys(obj).map(k => `\\${k}\\${obj[k]}`);
    const str = arr.join('');
    return str;
  }

  getState(s) {
    const a = s.split('\n');
    a.shift();
    const r = {};

    for (const line of a) {
      if (!line) continue;
      const e = line.split(' ');
      const key = e.shift();
      const value = e.map(x => +x);
      r[key] = value
    }

    return r;
  }

  makeState(obj) {
    const s = Object.entries(obj).map(([prop, v]) => `${prop} ${v.join(' ')}`).join('\n');
    return s;
  }

  async getPlayerState(p) {
    if (!p) throw 'not found';
    const state = await this.urt4.rpc(`sv getps ${this.getClient(p)}`);
    const result = this.getState(state);
    return result;
  }

  setPlayerState(p, obj) {
    const from = {};

    for (const [prop, v] of Object.entries(obj)) {
      if (prop === 'ang') from[prop] = [v[0] - 11].concat(v.slice(1)); // ioq3 +11 deg chicken
      else from[prop] = v;
    }

    const s = this.makeState(from);
    this.urt4.cmd(`sv ps ${this.getClient(p)} ${s}`);
  }

  getPlayerViewPos(state) {
    const pos = [...state.pos];
    pos[2] += state.view[0];
    return pos;
  }

  async onDrop({client, reason, message}) {
    const player = this.clients[client];
    if (!player) return;
    player.dropped = {reason, message, at: new Date()};
  }

  async onConnect({client}) {
    let player = this.clients[client];

    if (!player || player.dropped) {
      if (player) await this.deleteClient(client);

      this.clients[client] = player = {
        client,
        level: 0,
        cmd: {},
        sets: {},
        prefs: {},
        dialogs: []
      };
    }
  }

  async onDisconnect({client}) {
    const player = this.clients[client];

    if (player && !player.dropped) {
      player.dropped = {reason: 'fake', message: 'disconnected without drop', at: new Date()};
    }
  }

  async updateClient(client, info) {
    let player = this.clients[client];
    if (!player) return;

    const pi = this.getInfo(info);
    const guid = pi.cl_guid || pi.guid;

    player.guid = guid;
    player.info = pi;
    player.index = `${this.admin.norm(pi.name)}:${this.admin.norm(pi.authl)}`;

    if (!player.ip) {
      const ents = pi.ip && pi.ip.match(this.$.rxIp);
      player.ip = (ents && ents[0]) || '0.0.0.0';
    }

    const state = await this.getPlayerState(player);
    player.ping = state.ping[0];

    const ip = player.ip;
    player.localIp = this.$.rxIpLocal.test(ip);

    if (ip && !(ip in this.geoip)) {
      this.geoip[ip] = null;

      if (player.localIp) {
        this.geoip[ip] = {country_name: 'local intranet'};
      } else try {
        const accessKey = this.$.get(config, 'ip', 'accessKey');

        if (accessKey) {
          const res = await web.get(`http://api.ipstack.com/${ip}?access_key=${accessKey}`);
          this.geoip[ip] = res.data;
        }
      } catch (err) {
        this.$.throw(err, 'GEO IP');
      }
    }

    if (!player.info2) {
      const info2src = await this.urt4.rpc(`sv getcfg ${544 + client}`);

      if (info2src) {
        const info2 = this.getInfo(`\\${info2src}`);
        player.info2 = info2;
      }
    }

    if (!this.authEngine && !player.authEmuled) {
      player.authEmuled = true;
      this.$qvm.emit('auth', {client, auth: ''});
    }
  }

  async deleteClient(client) {
    return delete this.clients[client];
  }

  text(s) {
    return `"${(s || '').toString().replace(this.$.rxQuotes, '\'\'')}"`;
  }

  getTeamPlayers(teamCode) {
    const result = Object.values(this.clients).filter(p => p.info2 && p.info2.t == teamCode);
    return result;
  }

  getActivePlayers() {
    const result = Object.values(this.clients).filter(p => !p.dropped && p.info2 && p.info2.t !== '3');
    return result;
  }

  getPlayers(players) {
    if (players === null) return Object.values(this.clients);
    if (players === undefined) return;
    if (players instanceof Array) return players;
    return [players];
  }

  getClient(player) {
    const client = player == null ? -1 : typeof player === 'object' ? player.client | 0 : player | 0;
    return client;
  }

  getClients(players) {
    if (players === null) return [-1];
    if (players === undefined) return;
    if (players instanceof Array) return players.map(this.getClient);
    return [this.getClient(players)];
  }

  chatLine(clientsSrc, msg, svcmd) {
    const clients = this.getClients(clientsSrc);
    if (!clients || !clients.length) return;
    const conOut = clients.filter(c => c < 0);
    if (conOut.length) this.urt4.log(this.urt4.noColor(msg));

    const cmds = (
      clients.filter(c => c != -2)
      .map(c => `sv svcmd ${this.getClient(c)} ${svcmd || 'chat'} ${this.text(msg)}`)
    );

    if (cmds.length) this.urt4.cmds(cmds);
  }

  textChop(line, limit) {
    const ents = (line || '').toString().split(this.$.rxWhiteSpace);
    const buf = [];
    const lines = [];
    let len = 0;
    let lastColor;

    for (const ent of ents) {
      len += ent.length;

      if (len > limit) {
        lines.push(buf.join(''));
        buf.length = 0;
        if (lastColor != null) buf.push(lastColor);
        len = ent.length;
      }

      const colors = ent.match(this.urt4.$.rxColor);
      if (colors && colors.length) lastColor = colors.pop();
      buf.push(ent);
    }

    lines.push(buf.join(''));
    return lines;
  }

  chat(clients, msg, svcmd) {
    const array = msg instanceof Array ? msg : [msg];
    const chunked = array.map(line => this.textChop(line, 90));
    const r = this.$.flatten(chunked);

    (async() => {
      for (let i = 0; i < r.length; i++) {
        if (i && !(i % 20)) await this.$.delay(100);
        this.chatLine(clients, (r[i] || '').toString(), svcmd);
      }
    })();
  }

  message(clients, msg) {
    return this.chat(clients, msg, 'print');
  }

  big(clients, msg) {
    return this.chat(clients, msg, 'cp');
  }

  big2(clients, msg) {
    return this.chat(clients, msg, 'cs 1001');
  }

  findAll(filter, all) {
    const f = this.admin.norm(filter);
    const result = [];

    for (const [client, obj] of Object.entries(this.clients)) {
      if (!all && obj.dropped) continue;
      if (f && obj.index.indexOf(f) < 0) continue;
      result.push(obj);
    }

    result.sort(this.admin.sortByIndex);
    return result;
  }

  name(player) {
    const p = typeof player === 'object' ? player : this.clients[player];
    if (!p || !p.info) return `^8Big Brother ^9E-[`;
    return `^5${p.info.name}^9#${p.client}^3`;
  }

  ncname(player) {
    return this.urt4.noColor(this.name(player));
  }

  findResult(player) {
    const auth = player.info.authl;
    let res = player.info.name;
    if (auth) res += ` ^3[^5${auth}^3]`;
    return res;
  }

  findEnt(filter, as, def) {
    const n = filter | 0;
    if (filter == n) return n;
    const player = this.find(filter, as, def);
    return player.client;
  }

  find(filter, as, opts) {
    let {def, all} = !opts ? {} : typeof opts === 'boolean' ? {def: opts} : opts;

    if (!filter) {
      if (def) return as; else throw [
        `^1Error ^3Please specify player ^5ID^3 or ^5part of name/auth^3`,
        ` or "^5.^3" (dot) to match yourself`
      ];
    }

    if (filter === '$me') return as;

    const byId = this.clients[filter];
    if (byId) return byId;
    if (filter === '.') return as;

    all = this.findAll(filter, all);
    if (!all.length) throw `^1Error ^3No results found searching for player "^5${filter}^3"`;
    if (all.length === 1) return all[0];
    if (all.length >= 30) throw `^1Error ^3Too much of matches. Please improve your search phrase`;
    const msg = [`^1Error ^3Several player matches for phrase "^5${filter}^3"`];

    for (let i = 0; i < all.length; i += 3) {
      const slice = all.slice(i, i + 3);
      msg.push(slice.map(player => ` ^5${player.client}^2 : ^3${this.findResult(player)}`).join(';'));
    }

    msg.push(`^3Use ^5ID^3 of listed above instead of search phrase`);
    throw msg;
  }

  async logBlames({as, blames, cmd}) {
    const admins = (
      Object.values(this.clients)
      .filter(player => /*player !== as && */player.level >= as.level)
    );

    const bcast = (
      blames
      .filter(player => player ? player.level >= as.level : admins.length)
      .map(player => player ? player.client : admins)
    );

    const bcastf = this.$.flatten(bcast);
    const bcastu = this.$.uniqKeys(bcastf, true);
    this.chat(bcastu, `^6CMD ^5${this.name(as)}^3 : ${cmd}`);
  }

  async execCmdOrClcmd(as, line) {
    const result = await this.admin.execCmd(as, line);
    if (result !== this.admin.$.cmdErrors.missing) return result;
    const handled = await this.urt4.sv.emit('clcmd', {cmd: line, client: as.client});
    if (!handled) this.urt4.cmd(`sv clcmd ${as.client} 1 ${line}`);
  }

  clCmdResult({cmd, client, result}) {
    const e = this.admin.$.cmdErrors;

    switch (result) {
      case e.missing:
        this.chat(client, `^1Error ^3Unknown command "^5${cmd}^3"`);
        break;

      case e.access:
        this.chat(client, `^1Error ^3No permission for "^5${cmd}^3"`);
        break;

      case e.help:
        const cmdObj = this.admin.cmds[cmd];
        if (!cmdObj) { this.$.log(`!!! Fake command: ${cmd}`); break; }
        this.chat(client, `^7Usage: ^3"^5${cmd} ^7${cmdObj.args}^3" : ${cmdObj.info}`);
        break;

      default:
        if (result) this.chat(client, result);
        break;
    }

    return true;
  }

  async execCmd(as, cmd) {
    const blames = [];
    const result = await this.admin.execCmd(as, cmd, {blames});
    if (blames.length) await this.logBlames({cmd, blames, as});
    return result;
  }

  async onClCmd({cmd, client}) {
    const player = this.clients[client];
    if (!player || player.dropped) return true;

    if (this.urt4.act) this.urt4.log(`${this.ncname(player)} > ${cmd}`);

    const [, sayMethod, sayQ, sayCmd] = cmd.match(this.$.rxSayCmd) || [];

    if (sayCmd) {
      const sCmd = !sayQ ? sayCmd : sayCmd.substr(0, sayCmd.length - 2);
      const result = await this.execCmd(player, sCmd);
      return this.clCmdResult({cmd: sCmd, client, result});
    }

    const [, sayTellMethod, sayTellCmd] = cmd.match(this.$.rxSayTellCmd) || [];

    if (sayTellCmd) {
      const sCmd = sayTellCmd;
      const result = await this.execCmd(player, sCmd);
      return this.clCmdResult({cmd: sCmd, client, result});
    }

    const [customCmd] = cmd.match(this.$.rxCustomCmd) || [];

    if (customCmd && customCmd.toLowerCase() in this.admin.cmds) {
      const sCmd = cmd;
      const result = await this.execCmd(player, sCmd);
      return this.clCmdResult({cmd: sCmd, client, result});
    }

    return false;
  }

  async onSvCmd({cmd, client}) {
    const player = this.clients[client];
    if (!player || player.dropped) return;

    if (cmd === 'print "g_maxGameClients has been reached, you cannot join"') {
      if (player.auth) {
        this.chat(player, [
          '^2Tip:^3 You may take slot of any player without auth or lower role',
          ' by using ^5!slot^3 command.'
        ]);
      } else {
        this.chat(player, [
          '^2Tip:^3 Please rejoin with your ^5auth^3 to be allowed to take slots of other players',
          ' by using ^5!slot^3 command.'
        ]);
      }
    }

    if (this.urt4.act) this.urt4.log(`${this.ncname(player)} < ${cmd}`);
    const [, loc] = cmd.match(this.$.rxLocation) || [];
    if (loc) player.location = +loc;
  }

  async getLocationNames(locs) {
    const res = locs || (await this.urt4.rpc('sv getcfgs 640 1000'));
    const arr = res.split('\n');

    const locNames = this.$.makeObject(arr.map((line) => {
      const [, id, name] = line.match(this.$.rxCfgsItem) || [];
      if (!id) return null;
      const obj = {[id - 640]: name};
      return obj;
    }));

    return locNames;
  }

  async getLocationName(id) {
    if (!id || id < 0 || id >= 360) return null;
    const locName = await this.urt4.rpc(`sv getcfg ${+id + 640}`);
    return locName;
  }

  async onEnt({id, state}) {
    /*const st = this.getState(state);

    if (!this.ents[id] || st.type.join() !== this.ents[id].type.join()) {
      console.log(id, state);
    }

    this.ents[id] = st;*/

    //if (/type 3 0/.test(state)) this.urt4.socket.write(`sv ent ${id} type 4 0 model 1 solid -1 mins -150 -150 -150 maxs 150 150 150\0`);
  }

  mapCmd(item) {
    return item.cmd;
  }

  levelName(level) {
    const levelName = (
      this.admin.$.levelNames[this.admin.$.levelIds[level]] ||
      `level ${player.level}`
    );

    return levelName;
  }

  sortByClient(a, b) {
    return a.client - b.client;
  }

  sortByIndex2(a, b) {
    return a.index2 > b.index2 ? 1 : a.index2 < b.index2 ? -1 : 0;
  }

  getTeamId(s) {
    if (!s) return 'free';
    const first = s.toString().toLowerCase().charAt(0);

    switch (first) {
      case '1': case 'r': return 'red';
      case '2': case 'b': return 'blue';
      case '3': case 's': return 'spec';
      default: return 'free';
    }
  }

  isTester(p, inSpec) {
    if (!p) return null;
    const P = p.prefs;
    if (!P) return false;
    if (!inSpec && P.testSpecOnly && this.$.get(p, 'info2', 't') !== '3') return false;
    if (P.specialHits || P.prettyHits || P.testKillpoints || P.testSpecOnly || P.testHitstats) return true;
    return false;
  }

  async forceTeam(player, teamId) {
    const nok = await this.emit('team', {client: player.client, player, teamId});
    if (!nok) this.urt4.cmd(`com in forceteam ${player.client} ${teamId}`);
    return nok;
  }

  prettifyAuth(player, p, srcAuth, embed) {
    const {$} = this.admin;
    let auth = srcAuth || p.auth || '';
    const noAuthColor = this.urt4.getBoolean(this.$.get(player, 'prefs', 'noAuthColor'));
    let levelColor = '';

    if (!noAuthColor) {
      const levelId = $.levelIds[p.level] || 0;
      const levelName = $.levelNames[levelId];
      levelColor = levelName.slice(0, 2);
      auth = `${levelColor}${auth}`;
    }

    if (!this.urt4.getBoolean(this.$.get(player, 'prefs', 'noAuthAddon'))) {
      const addon = this.$.get(p, 'authInfo', 'addon');

      if (addon) {
        const ents = addon.split(this.urt4.$.rxColor1);

        switch (ents.length) {
          case 1: auth = `${levelColor}${ents[0]}`; break;
          case 3: auth = `${levelColor}${ents[2]}`; break;
          case 5: auth = `^${ents[1] == 4 ? 2 : 7}${ents[2]}${levelColor}${ents[4]}`; break;
          case 7: auth = `^2${ents[2]}^7${ents[4]}${levelColor}${ents[6]}`; break;
        }
      }

      const tester = this.isTester(p);
      auth = `${p.donator ? '^2$' : ''}${tester ? '^2*' : ''}${auth}`;
    }

    if (!this.urt4.getBoolean(this.$.get(player, 'prefs', 'noAuthGeo'))) {
      const geo = this.geoip[p.ip];
      const cc = geo && geo.country_code;
      const geoInfo = ` ^7(${cc || '??'})`;
      auth = `${auth}${geoInfo}`;
    }

    if (!embed && this.$.rxWhiteSpace.test(auth)) {
      auth = `"${auth}"`;
    }

    if (!auth) auth = '---';
    return auth;
  }

  // CMD

  async ['ANY auth <urt-auth> <password>: Manually authenticate yourself (if UrT auth service is down etc).'](
    {as, args: [auth, pwd]}
  ) {
    if (!auth) return this.admin.$.cmdErrors.help;
    if (!pwd) return '^1Error ^3You must specify password';
    const res = await this.onAuth({client: as.client, auth}, pwd);
    if (this.$.get(res, 'error') === 'authFail') return '^1Error ^3Invalid credentials'; 
    return `^2AUTH ^3You've successfully logged in as ^5${auth}`;
  }

  async ['MOD+ alias [<player>]: List alias names for player or yourself.'](
    {as, args: [player]}
  ) {
    const p = this.find(player, as, true);
    if (!p.dbId) return `^1Error ^3Player is not registered`;
    const names = await this.$db.$users.getAliases(p.dbId);
    if (!names || !names.length) return `^1Error ^3Player has no names`;

    const normed = Object.keys(this.$.invert(names.map(name => this.urt4.noColor(name))));
    const joined = `${normed.join('  ')} `;
    const chopped = joined.match(this.$.rxChopLine);
    return [`^2Aliases for ^5${this.name(p)}^2:`, ...chopped];
  }

  async ['ANY setpassword <password>: Set your permanent password for manual auth. ^1CAUTION: ^3may not be safe!'](
    {as, args: [pwd]}
  ) {
    if (!pwd) return this.admin.$.cmdErrors.help;
    if (!as.auth) return '^1Error ^3You must be authed to use this feature';
    await this.$db.$users.setAuthPwd(as.auth, pwd, false);
    return `^2AUTH ^3You've successfully set up your password for manual auth`;
  }

  async ['ANY setotp <password>: Set your one-time password for manual auth.']({as, args: [pwd]}) {
    if (!pwd) return this.admin.$.cmdErrors.help;
    if (!as.auth) return '^1Error ^3You must be authed to use this feature';
    await this.$db.$users.setAuthPwd(as.auth, pwd, true);
    return `^2AUTH ^3You've successfully set up your one-time password for manual auth`;
  }

  async ['ANY getotp new: Get your one-time password for manual auth.']({as, args: [ok]}) {
    if (!ok) return this.admin.$.cmdErrors.help;
    if (ok !== 'new') return '^1Error ^3Please specify "new" as parameter to confirm';
    if (!as.auth) return '^1Error ^3You must be authed to use this feature';
    const pwd = parseInt(Math.random()*1e6);
    await this.$db.$users.setAuthPwd(as.auth, pwd, true);
    return `^2AUTH ^3Your one-time password is: ${pwd}`;
  }

  async [
    'MOD+ setlevel [<whom>] [<level>]: Set player authentication level / List levels'
  ]({as, args: [whom, level]}) {
    if (!whom) {
      return [
        '^2Available levels to assign:',
        ...Object.entries(this.admin.$.levelNames)
        .filter(([k]) => this.admin.$.levels[k] < as.level)
        .map(([k, v]) => `${k}^3 -- ${v}`)
      ];
    }

    const p = this.find(whom, as);
    if (p.dbId === as.dbId) return `^1Error ^3You can't change your own level`;

    if (!p.auth) return `^1Error ^3You may not assign a level to players without ^2auth`;

    const levelId = this.admin.norm(level) || 'mod';
    const levelValue = this.admin.$.levels[levelId];
    if (levelValue == null) return `^1Error ^3Unknown level: ^5${levelId}`;

    if (as.level <= p.level || as.level <= levelValue) {
      return this.admin.$.cmdErrors.access;
    }

    await this.set(p, {level: levelValue});
    const levelName = this.admin.$.levelNames[levelId];
    this.chat(p, `^3Your ^5level has been changed to: ${levelName}`);
    return `${this.name(p)} now is ^2${levelName}`;
  }

  async ['TMOD+ chat <player> <...text>: Send raw chat message to player'](
    {as, blames, args: [player, ...text]}
  ) {
    const p = this.find(player, as);
    const arg = text.join(' ');
    this.chat(p.client, arg);
    blames.push(null);
    return [`^2Chat message has been sent`];
  }

  async ['TMOD+ big <...text>: Send big message to everyone'](
    {as, blames, args: [...text]}
  ) {
    const arg = text.join(' ');
    this.big(null, arg);
    this.message(null, `^6ALL:^7 ${arg}`);
    blames.push(null);
    return [`^2Big message has been sent`];
  }

  async ['ANY+ help [<filter>]: Show help']({as, args}) {
    const arg = args.join(' ');
    const filter = this.admin.norm(arg);
    const found = [];

    for (const [cmd, cmdObj] of Object.entries(as.allowedCmds || this.admin.cmds)) {
      if (cmdObj.level > as.level) continue;
      const index = cmdObj.index.indexOf(filter);
      if (index < 0) continue;
      found.push({cmd, cmdObj, index, index2: cmdObj.index});
    }

    this.chat(as.client, ` ^3 Hello "^5${this.name(as)}^3". You're ^2${this.levelName(as.level)}`);

    if (as.info) {
      if (as.info.authl) {
        this.chat(as.client, ` ^3 Your auth is "^5${as.info.authl}^3".`);
      } else {
        this.chat(as.client, ` ^3 You are ^1not^3 authorized.`);
      }
    }

    if (!found.length) return `^1Error ^3No available commands matching "^5${arg}^3"`;

    if (filter) {
      found.sort(this.admin.sortByIndex);
    } else {
      found.sort(this.sortByIndex2);
    }

    this.chat(as.client, `^2Available commands:`);

    if (found.length < 10 || filter) {
      found.splice(30);
      const resd = found.map(({cmd, cmdObj}) => `^3"^5${cmd} ^7${cmdObj.args}^3" : ${cmdObj.info}`).sort();
      if (found.length === 30) resd.push('^2...');
      this.chat(as.client, resd);
    } else {
      for (let i = 0; i < found.length; i += 8) {
        this.chat(as.client, `^5${found.slice(i, i + 8).map(this.mapCmd).join(' ')}`);
      }

      this.chat(as.client, `^3  Use ^5help <filter>^3 to narrow down the search`);
    }
  }

  async ['SUP spy <on|off>: Spectating spy mode (invisible spectator)']({as, args: [value]}) {
    if (!value) return `^3Your spy mode is ^2${this.urt4.showBoolean(as.hidden)}`;
    as.hidden = this.urt4.getBoolean(value);
    return `^3Your spy mode now is ^2${this.urt4.showBoolean(as.hidden)}`;
  }

  async ['MOD+ autobal <on|off>: Auto team balance']({as, args: [value]}) {
    if (!value) {
      const old = await this.urt4.rpc(`com getcvar g_autobalance`);
      return `^3Auto team balance is ^2${this.urt4.showBoolean(old | 0)}`;
    }

    const v = this.urt4.getBoolean(value);
    this.urt4.cmd(`com cvar 1 g_autobalance ${v}`);
    this.chat(null, `^3Auto team balance now is ^2${this.urt4.showBoolean(v)}`);
  }

  async ['ANY+ list [<filter>]: List players']({as, args}) { return this.list({as, args, dropped: false}); }
  async ['ANY+ listdc [<filter>]: List recently disconnected players']({as, args}) { return this.list({as, args, dropped: true}); }

  async list({as, args, dropped}) {
    const {$mod} = await this.admin;
    const arg = args.join(' ');
    const filter = this.admin.norm(arg);
    const found = this.findAll(filter, as.level >= this.admin.$.levels.mod);
    if (!found.length) return `^1Error ^3No players matching "^5${arg}^3"`;
    this.chat(as.client, filter ? `^2Players matching "^5${arg}^2"` : `^2All players:`);

    found.sort(this.sortByClient);

    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = $mod.modes[mode];

    for (const player of found) {
      if (dropped != null && (!dropped ^ !player.dropped)) continue;
      const levelName = this.levelName(player.level);
      const tester = this.isTester(player, true);

      this.chat(as.client, `^5${player.client} ` +
        `^7${this.findResult(player)} ` +
        `^2${levelName}` +
        `${player.donator ? ' ^2$donator' : ''}` +
        `${tester ? ' ^2*tester' : ''}`
      );

      const geoip = this.geoip[player.ip] || {country_name: 'Unknown location'};

      const geoipStr = [
        geoip.country_name,
        geoip.region_name,
        geoip.city,
        as.level >= this.admin.$.levels.sup && `^5${player.ip}^3`
      ].filter(this.$.echo).map(s => this.urt4.normText(s)).join(', ');

      this.chat(as.client, `  \\ ^3[${geoipStr}]`);
      const d = player.dropped;

      if (d) {
        const ago = this.urt4.showTimeSpan(new Date() - d.at);
        const text = [`   \\ ^1disconnected ^2${ago}^1 ago`];
        if (d.reason) text.push(`^7: ^5${d.reason}`);
        if (d.message) text.push(`^7: ^3${d.message}`);
        this.chat(as.client, text.join(''));
        if (player.banned) this.chat(as.client, `   ** ^3Banned by ^5${player.banned.byAuth}`);
      } else if (as.level >= this.admin.$.levels.sup || modeObj.mod.emitLoc) {
        const locName = $mod.locations[player.location];
        if (locName) this.chat(as.client, `   \\ ^5On map:^3 ${locName}`);
      }
    }
  }

  async ['ADMIN+ raw <...command>: Send raw command to server (wrong may crash server!)']({as, args}) {
    const arg = args.join(' ');
    this.urt4.cmd(arg);
    return [`^2Raw command has been sent`];
  }

  async ['ADMIN+ rpc <...command>: RPC command to server (wrong may crash server!)']({as, args}) {
    const arg = args.join(' ');
    const res = await this.urt4.rpc(arg);
    return [`^2RPC response:`].concat(res.split('\n'));
  }

  async ['ADMIN+ pset <player> <key> <value>: Player setting']({as, args: [player, key, ...values]}) {
    const p = this.find(player, as);
    const value = values.join(' ');
    await this.set(p, {[key]: value});
    return `^3Setting for ${this.name(p)} has been set: ^2${key}^3 = ^5${value}`;
  }

  async ['ADMIN+ svr <...command>: Send RCON command to server']({as, args}) {
    const arg = args.join(' ');
    const res = await this.urt4.rpc(`com rpc ${arg}`);
    return [`^2Response from command:`].concat(res.split('\n'));
  }

  async ['ANY prefs <setup|setting> [<setting value>] : Set personal preferences']({as, args: [setup, ...values]}) {
    if (!setup) {
      return [
        '^2Your preference settings:',
        ...Object.entries(this.$.prefs).map(([k, v]) =>
          ` ^5${k}: ^2${this.urt4.showValueByType(this.$.get(as, 'prefs', k), v.type)} -- ^3${v.desc} (^2${this.urt4.typeName(v.type)}^3)`
        ),
        '^2Available preference setups:',
        ...Object.entries(this.$.prefSetups).map(([k, v]) => ` ^5${k}^3 -- ${v.desc}`)
      ];
    }

    const sets = this.$.prefSetups[setup];

    if (sets) {
      await this.set(as, this.$.mapKeys(sets.prefs, k => `prefs.${k}`));

      return [
        `^3Your ^5preferences^3 have been set to ^2${setup}`,
        '^5Note ^3Some settings may require reconnect to take effect'
      ];
    }

    const pref = this.$.prefs[setup];

    if (!pref) return `^1Error ^3Preference or setup ^5${setup}^3 is unknown`;

    if (!values.length) return [
      '^2Your preference setting:',
      ` ^5${setup}: ^2${this.urt4.showValueByType(this.$.get(as, 'prefs', setup), pref.type)} -- ^3${pref.desc} (^2${this.urt4.typeName(pref.type)}^3)`
    ];

    const value = values.join(' ');
    const norm = this.urt4.getValueByType(value, pref.type);
    await this.set(as, {[`prefs.${setup}`]: norm});

    return [
      `^3Your preference ^5${setup}^3 has been set to ^2${this.urt4.showValueByType(norm, pref.type)}`,
      '^5Note ^3Some settings may require reconnect to take effect'
    ];
  }

  async ['MOD+ move [<player>]: Move player or yourself to different team']({as, blames, args: [player]}) {
    const p1 = this.find(player, as, true);
    const cur = this.$.get(p1, 'info2', 't');
    if (!(cur in this.$.pvpTeam)) return `^1Error ^3Player ^5${this.name(p1)}^3 is not in competing team`;
    this.urt4.cmd(`com in forceteam ${p1.client} ${this.getTeamId(3 - cur)}`);
    this.chat(null, `^3Player ${this.name(p1)} has been moved to other team`);
    blames.push(null);
    return 0;
  }

  async ['MOD+ spec [<player>]: Move player or yourself to spectator']({as, blames, args: [player]}) {
    const p1 = this.find(player, as, true);
    const cur = this.$.get(p1, 'info2', 't');
    if (cur == 3) return `^1Error ^3Player ^5${this.name(p1)}^3 is already a spectator`;
    this.urt4.cmd(`com in forceteam ${p1.client} s`);
    this.chat(null, `^3Player ${this.name(p1)} has been moved to spectators`);
    blames.push(null);
    return 0;
  }

  async ['MOD+ swap <player1> [<player2>]: Exchange players in different teams. Exchange yourself with player in different team']({as, blames, args: [player1, player2]}) {
    if (!player1) return this.admin.$.cmdErrors.help;
    const p1 = this.find(player1, as);
    const p2 = this.find(player2, as, true);
    const both = `${this.name(p1)}^3 and ${this.name(p2)}^3`;

    if (this.$.get(p1, 'info2', 't') === this.$.get(p2, 'info2', 't')) {
      return `^1Error ^3Players ${both} are in the same team`;
    }

    this.urt4.cmd(`com in swap ${p1.client} ${p2.client}`);
    this.chat(null, `^3Players ${both} have been swapped`);
    blames.push(null);
    return 0;
  }

  async ['ANY+ team <team> [<player>] ["deny"|"auto"|"allow"]: Change team of player. "deny" - deny any team change; "auto" - allow only auto join; "allow" - no restrictions'](
    {as, blames, args: [team, player, force]}
  ) {
    const $mod = await this.admin.$mod;

    if (!team) return this.admin.$.cmdErrors.help;
    const teamId = this.getTeamId(team);

    if (!player || as.level < this.admin.$.levels.mod) {
      if (as.client < 0) return '^1Error ^5You\'re not a player';

      if (teamId in this.$.teamDenyManual && this.$.get(as, 'sets', 'player', 'teamDenyManual')) {
        return `^1Error ^3You are allowed to ^2Auto-join^3 only`;
      }

      if (this.$.get(as, 'sets', 'player', 'teamDenyAll')) {
        return `^1Error ^3You are not allowed to ^2choose a team^3`;
      }

      let nok;

      if ($mod.sets.fastTeam) {
        nok = await this.forceTeam(as, teamId);
      } else {
        nok = await this.emit('team', {client: as.client, player: as, teamId});
        if (!nok) this.urt4.cmd(`sv clcmd ${as.client} 1 team ${teamId}`);
      }

      if (nok) return `^1Error ^3You can't change your team`;
      return;
    }

    const p = this.find(player, as, true);
    if (p.client < 0) return '^1Error ^5You\'re not a player';
    if (await this.forceTeam(p, teamId)) return `^1Error ^3You can't change team for ${this.name(p)}`;

    switch (force && force.toLowerCase()) {
      case 'deny': {
        await this.set(p, {'sets.player.teamDenyAll': 1});
        this.chat(null, `^3Player ${this.name(p)}^3 was disallowed to ^2choose a team^3`);
      }; break;

      case 'auto': {
        await this.set(p, {'sets.player.teamDenyManual': 1});
        this.chat(null, `^3Player ${this.name(p)}^3 was allowed to ^2Auto-join^3 only`);
      }; break;

      case 'allow': {
        await this.set(p, {
          'sets.player.teamDenyAll': 0,
          'sets.player.teamDenyManual': 0
        });

        this.chat(null, `^3Player ${this.name(p)}^3 was allowed to manually ^3choose a team`);
      }; break;
    }

    blames.push(null);
    this.chat(null, `^3Player ${this.name(p)}^3 has been moved to team ${this.$.teamDesc[teamId]}`);
    return 0;
  }
}

Players.rxCfgsItem = /^(\d+) (.*)$/;
Players.rxCustomCmd = /^\w+/;
Players.rxIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
Players.rxIpLocal = /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2|3[01])\./;
Players.rxIpA = /^\d{1,3}\./;
Players.rxIpB = /^\d{1,3}\.\d{1,3}\./;
Players.rxIpC = /^\d{1,3}\.\d{1,3}\.\d{1,3}\./;
Players.rxQuotes = /"/g;
Players.rxSayCmd = /^(say|sayteam)\s+("?)[!@&\/\\.]([\S\s]+?)$/;
Players.rxSayTellCmd = /^tell\s+\S+\s+[!@&\/\\.]([\S\s]+?)$/;
Players.rxUnwrapInfo = /\\[^\\]+\\[^\\]*/g;
Players.rxUnwrapInfoPairs = /^\\([^\\]+)\\([^\\]*)$/;
//Players.teams = {f: 0, r: 1, b: 2, s: 3};
//Players.teamIds = Players.invert(Players.teams);
Players.rxRawPlayers = /^(\d+):(.*) TEAM:(\w+) KILLS:(\d+) DEATHS:(\d+) ASSISTS:(\d+) PING:(\d+) AUTH:(\w+|---) IP:([\d\.:]+)$/;

Players.rxRawPlayersAuth = /^(\d+):.* TEAM:\w+ KILLS:\d+ DEATHS:\d+ ASSISTS:\d+ PING:(\d+) AUTH:(\w+|---) IP:([\d\.:]+)$/;

Players.rxWhiteSpace = /(?=\s)/;
Players.rxWhite = /\^7/g;
Players.rxLocation = /^location (\d+)\n$/;

Players.rxRawPlayersStats = /^(\d+):.* TEAM:\w+ KILLS:(\d+) DEATHS:(\d+) ASSISTS:(\d+) PING:\d+ AUTH:(?=\w+|---) IP:[\d\.:]+(?=\n(.*))?$/;
//Players.rxStats = ;

Players.rxChopLine = /\S{1,88}\s+/g;

Players.teams = {
  free: 0,
  red: 1,
  blue: 2,
  spec: 3
};

Players.teamNames = Players.invert(Players.teams);

Players.teamDesc = {
  free: '^2Auto join',
  red: '^1Red',
  blue: '^4Blue',
  spec: '^7Spectator'
};

Players.teamDenyManual = {
  red: 1,
  blue: 2
};

Players.playingTeam = {
  0: true,
  1: true,
  2: true
};

Players.pvpTeam = {
  1: true,
  2: true
};

Players.prefs = {
  noAuthAddon: {type: Boolean, desc: 'Do not expand auth addons of players'},
  noAuthColor: {type: Boolean, desc: 'Do not colorize auths with player level color'},
  noAuthGeo: {type: Boolean, desc: 'Do not append auth with country code'},
  noNameColor: {type: Boolean, desc: 'Do not show custom colors in player names'},
  noWatchInfo: {type: Boolean, desc: 'Do not show info about spectators watching players'},
  noSameResp: {type: Boolean, desc: 'Do not respawn on a place before team change'},
  noSaveLoadBind: {type: Boolean, desc: 'Do not bind drop kevlar to save and drop flag/medkit to load in jump mode'},
  noShowTips: {type: Boolean, desc: 'Do not spam tips after first join'},
  noInfSta: {type: Boolean, desc: 'Do not make infinite stamina in jump mode'},
  specialHits: {type: Boolean, desc: 'Report all special hits (which are not reported by game)'},
  //noExplHits: {type: Boolean, desc: 'Do not report hits from projectile explosions'},
  //noWorldHits: {type: Boolean, desc: 'Do not report hits from world'},
  prettyHits: {type: Boolean, desc: 'Report prettified gun hits (if set, recommended to disable Hitting info on client)'},
  testHitstats: {type: Boolean, desc: 'Test hitstats feature (killpoins in TAB scoreboard)'},
  testKillpoints: {type: Boolean, desc: 'Report number of killpoints earned by you and your attackers'},
  testSpecOnly: {type: Boolean, desc: 'Participate in testing only when following others in spec'},
};

Players.prefSetups = {
  fun: {
    desc: 'Fun style (colors, auth expansion, watch info)',

    prefs: {
      noAuthAddon: 0,
      noAuthColor: 0,
      noAuthGeo: 0,
      noNameColor: 0,
      noWatchInfo: 0,
      noSameResp: 0,
      noSaveLoadBind: 0,
      noShowTips: 0,
      noInfSta: 0,
      specialHits: 0,
      //noExplHits: 0,
      //noWorldHits: 0,
      prettyHits: 0,
      testKillpoints: 0,
      testSpecOnly: 0,
      testHitstats: 0,
    }
  },

  strict: {
    desc: 'Classic style (no colors, no auth expansion, no watch info)',

    prefs: {
      noAuthAddon: 1,
      noAuthColor: 1,
      noAuthGeo: 1,
      noNameColor: 1,
      noWatchInfo: 1,
      noSameResp: 1,
      noSaveLoadBind: 1,
      noShowTips: 1,
      noInfSta: 1,
      specialHits: 1,
      //noExplHits: 1,
      //noWorldHits: 1,
      prettyHits: 0,
      testKillpoints: 0,
      testSpecOnly: 1,
      testHitstats: 0,
    }
  },
};

module.exports = Players;
