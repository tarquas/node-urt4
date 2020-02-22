const Cmd = require('./cmd');

const util = require('util');
const fs = require('fs');
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

class Mod extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$players', '$qvm'),
      ...this.$.pick(this.urt4, 'sv', 'com')
    });

    this.ignoreMapHook = true;
    this.maps = {};
    this.modes = {};
    this.sets = {};

    this.com.on('fs_restart', this.onMaps.bind(this));
    this.sv.on('cfg', this.onCfg.bind(this));
    this.sv.on('map', this.onMap.bind(this));
    this.com.on('in', this.onIn.bind(this));
    this.com.on('cvar', this.onCvar.bind(this));

    this.startup();
  }

  async startup() {
    await this.urt4.$info[this.$.ready];

    // get map list and modes
    this.matchSetting = this.matchSettingFunc.bind(this);
    const mapsArr = await this.urt4.rpc('com getmaps ');
    const maps = mapsArr.split('\n');
    maps.shift();
    //await this.onMaps({maps});
    await this.urt4.com.emit('fs_restart', {maps});

    // get current map
    const map = await this.urt4.rpc('com getcvar mapname');
    //await this.onMap({map});
    await this.sv.emit('map', {map});
    await this.$players.getCfgMap();
    await this.$players.initExistingClients();

    const info = await this.urt4.$info.getServerInfo();
    await this.$players.initClientAuths(info);
    await this.$qvm.emit('game', {});
    await this.$qvm.emit('world', {});

    const pbt = info.playersByTeam;
    //if (info.Scores && (!('RED' in pbt) || !('BLUE' in pbt))) await this.$qvm.emit('warmup', {}); else
    await this.$qvm.emit('round', {});
  }

  async getModes() {
    const {$mod} = this.$db;
    this.modesDisabled = {};
    this.modes = await $mod.getConfig(this.urt4.name);
    if (!this.modes) this.modes = await $mod.getConfig();

    for (const [mode, modeObj] of Object.entries(this.modes)) {
      if (!modeObj.enabled) {
        this.modesDisabled[mode] = modeObj;
        delete this.modes[mode];
        continue;
      }

      this.setMaps(modeObj.maps, modeObj.mapObjs = {});
    }
  }

  async detectMode(known) {
    const pres = {...this.$.preSetsRating};
    for (const key in known) delete pres[key];
    const keys = Object.keys(pres);
    const values = await this.urt4.rpcs(keys.map((key) => `com getcvar ${key}`));
    for (let i = 0; i < keys.length; i++) pres[keys[i]] = values[i];
    Object.assign(pres, known);

    const scores = {};
    const modes = Object.entries(this.modes);

    for (const [mode, modeObj] of modes) {
      const s = modeObj.pre;
      scores[mode] = 0;

      for (const [key, score] of Object.entries(this.$.preSetsRating)) {
        if ((s[key] | 0) === (pres[key] | 0)) {
          scores[mode] += (score | 0) + 1;
        }
      }
    }

    const w = (
      modes
      .map(([mode]) => [mode, scores[mode]])
      .filter(a => a[1] >= keys.length)
      .reduce((a, b) => a[1] >= b[1] ? a : b, [, -1])
    );

    return w[0];
  }

  trim(s) { return s.trim(); }

  notFalsy(x) { return x; }

  matchSettingFunc(line) {
    return line.match(this.$.rxSetting);
  }

  convMatchedObject([, k, v]) {
    return ({[k]: v});
  }

  async onIn({cmd}) {
    const [, , map] = cmd.match(this.$.rxMapCmd) || [];

    if (map) {
      if (this.ignoreMapHook || !this.map) return false;
      this.ignoreMapHook = true;
      await this.changeMap(map);
      return true;
    }

    const as = {
      virtual: true,
      client: -2,
      level: this.admin.$.levels.console,
      allowedCmds: this.admin.modCmds
    };

    const result = await this.admin.execCmd(as, cmd, {blames: []});

    if (result !== this.admin.$.cmdErrors.missing) {
      return this.$players.clCmdResult({cmd, client: -2, result});
    }

    return false;
  }

  async onCfg(cfg) {
    //console.log(cfg);
  }

  async modesRestrictedAdjust() {
    const allowed = await this.urt4.rpc('com getcvar nodeurt_modes');
    const ents = allowed.split(this.$.rxModeSep).filter(m => m in this.modes);

    if (ents.length) {
      const idx = this.$.invert(ents);

      for (const [m, o] of Object.entries(this.modes)) {
        o.restricted = !(m in idx);
      }
    } else {
      for (const [m, o] of Object.entries(this.modes)) {
        o.restricted = false;
      }
    }
  }

  async onMap({map, keepHook}) {
    if (!keepHook) this.ignoreMapHook = false;

    const [gametype, mode, name, locs] = await this.urt4.rpcs([
      'com getcvar g_gametype',
      'com getcvar nodeurt_mode',
      'com getcvar sv_hostname',
      'sv getcfgs 640 1000'
    ]);

    this.urt4.name = name;
    this.gametype = gametype;
    this.locations = await this.$players.getLocationNames(locs);

    if (!this.map) {
      await this.modesRestrictedAdjust();
    }

    if (map === 'nomap') {
      return this.setNextMode(mode);
    }

    this.map = map;

    const modeObj = this.modes[mode];

    if (modeObj) {
      if (modeObj.nextmode) this.setNextMode(modeObj.nextmode);
      const posts = Object.entries(modeObj.post).map(([k, v]) => `com cvar 0 ${k} ${v}`);
      this.urt4.cmds(posts);
      this.maps = modeObj.mapObjs;
      this.$.setTree(modeObj.mod, this.sets, {});
    } else {
      this.setMaps(this.allMaps);
    }

    const isNextMap = await this.urt4.rpc('com getcvar g_nextmap');

    if (!isNextMap) {
      const nextmap = this.findNextMap(map, mode);
      if (nextmap) this.setNextMap(nextmap);
    }

    this.urt4.cmd(`com cvar 1 nodeurt_curmode ${mode}`);

    this.urt4.log(`^^ gametype ${this.gametype} map ${map} mode ${modeObj ? mode : 'unknown'}`);
    this.emit('map', {gametype: this.gametype, map: this.map});
  }

  findNextMap(map, mode) {
    const modeObj = this.modes[mode];
    const maps = modeObj ? modeObj.maps : this.allMaps;
    const index = maps.indexOf(map);
    if (index < 0) return maps[0];
    const nextmap = maps[index + 1];
    if (!nextmap) return maps[0];
    return nextmap;
  }

  setMaps(mapsSrc, toSrc) {
    if (!mapsSrc) return;
    const to = toSrc || (this.maps = {});
    let nextId = 0;

    const maps = mapsSrc.slice();
    maps.sort();

    for (const map of maps) {
      const id = ++nextId;
      to[id] = {index: this.admin.norm(map), id, map};
    }
  }

  async onMaps({maps}) {
    await this.getModes();
    this.allMaps = maps;

    if (this.map) {
      await this.modesRestrictedAdjust();
    }

    this.emit('maps', {maps});
  }

  findAllMaps(filter, mapsSrc) {
    const maps = mapsSrc || this.maps;
    const f = this.admin.norm(filter);
    const result = [];

    for (const obj of Object.values(maps)) {
      const idx = obj.index.indexOf(f);
      if (idx < 0) continue;
      result.push(obj);
    }

    result.sort(this.admin.sortByIndex);
    return result;
  }

  findMap(filter, mapsSrc) {
    if (!filter) throw `^1Error ^3Please specify map ^5ID^3 or ^5part of name`;
    const maps = mapsSrc || this.maps;
    const byId = maps[filter];
    if (byId) return byId.map;
    const all = this.findAllMaps(filter, maps);
    if (!all.length) throw `^1Error ^3No results found searching for map "^5${filter}^3"`;
    if (all.length === 1) return all[0].map;
    if (all.length >= 30) throw `^1Error ^3Too much of matches. Please improve your search phrase`;
    const msg = [`^1Error ^3Several map matches for phrase "^5${filter}^3"`];

    for (let i = 0; i < all.length; i += 3) {
      const slice = all.slice(i, i + 3);
      msg.push(slice.map(obj => ` ^5${obj.id}^2 : ^3${obj.map}`).join(';'));
    }

    msg.push(`^3Use ^5ID^3 of listed above instead of search phrase`);
    throw msg;
  }

  setNextMap(map) {
    const {$players} = this;
    this.urt4.cmd(`com cvar 1 g_nextmap ${map}`);
    $players.chat(null, `^3Next map is set to ^5${map}`);
  }

  onCvar({name, value}) {
    if (name === 'nodeurt_mode') {
      this.setNextMode(value);
    }
  }

  setNextMode(mode) {
    const modeObj = this.modes[mode];
    if (!modeObj) return null;

    const pres = Object.entries(modeObj.pre).map(([k, v]) => `com cvar 0 ${k} ${v}`);

    this.urt4.cmds([
      `com cvar 1 nodeurt_mode ${mode}`,
      ...pres
    ]);

    //this.setMaps(modeObj.maps);
    this.maps = modeObj.mapObjs;

    const nextmap = this.findNextMap(this.map, mode);
    if (!nextmap) return modeObj;

    if (this.map) this.setNextMap(nextmap);
    else this.urt4.cmd(`com in map ${nextmap}`);

    return modeObj;
  }

  listModes(mode, as) {
    const f = this.admin.norm(mode);
    const modes = Object.keys(this.modes).filter(mode => mode.indexOf(f) >= 0);
    //if (as.level < this.admin.$.levels.admin) modes = modes.filter(m => (
    modes.sort();
    const list = modes.map(mode => ` ^2${mode}^3 : ${this.modes[mode].desc}`);

    if (list.length) list.unshift(`^2Avaliable game modes${mode ? ` containing ^5${mode}^2` : ''}:`);
    else list.push(`^1Error ^3Unknown game mode ^5${mode}`);

    return list;
  }

  async changeMap(map) {
    const {$players} = this;
    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = this.modes[mode];
    const modeDesc = modeObj ? modeObj.desc : 'unknown mode';
    $players.chat(null, `^3Changing map to ^5${map}^3 at ^2${modeDesc}`);
    this.urt4.cmd('com in bigtext "^2Please wait!"');
    this.urt4.cmd('sv cfg 1001 "^2... ^1map is loading ^2..."');

    await this.$.delay(1000);
    this.urt4.cmd(`com in g_nextmap ${map}`);
    await this.$.delay(1000);

    this.map = map;
    this.urt4.cmd('com in cyclemap');
  }

  async checkGameAccess(as, modeObj) {
    if (modeObj.restricted && as.level < this.admin.$.levels.admin) {
      this.$players.chat(as, `^1Error ^3This game mode is restricted by ^1server administrator`);
      return false;
    }

    const pwd = modeObj.post.g_password;

    if (pwd && !as.virtual && as.info.password !== pwd) {
      this.$players.chat(as,
        `^1Error ^3Your password does not match with server's. ` +
        `Please set it with ^5/password^3 command first`
      );

      return false;
    }

    return true;
  }

  // CMD

  async ['TMOD+ cycle : Cycle map'](arg) { return await this.cycleMap(arg); }
  async ['TMOD+ cyclemap : Cycle map'](arg) { return await this.cycleMap(arg); }

  async cycleMap({as, blames, args: [name]}) {
    this.urt4.cmd(`com in cyclemap`);
    blames.push(null);
  }

  async ['ANY+ game [<mode>]: Set next game mode / show next game mode']({as, blames, args: [mode]}) {
    const {$players} = this;

    if (!mode) {
      const [gmode, nextmap] = await this.urt4.rpcs([
        'com getcvar nodeurt_mode',
        'com getcvar g_nextmap'
      ]);

      const obj = this.modes[gmode];
      return `^3Game mode for next map ^5${nextmap}^3 is ^5${obj ? obj.desc : gmode || 'unknown'}`;
    }

    if (as.level < this.admin.$.levels.tmod) return this.admin.$.cmdErrors.access;

    const modeObj = this.modes[mode];
    if (!modeObj) return `^1Error ^3Mode ^5${mode}^3 not found`;

    if (!await this.checkGameAccess(as, modeObj)) return this.admin.$.cmdErrors.access;

    this.setNextMode(mode);
    if (!modeObj) return this.listModes(mode, as);
    $players.chat(null, `^3Game mode for next map changed to ^2${modeObj.desc}`);
    blames.push(null);
  }

  async ['ANY+ games [<filter>]: List game modes']({as, blames, args: [mode]}) {
    return this.listModes(mode || '', as);
  }

  async ['ADMIN+ fs : Refresh configurations']({as, blames, args: [mode]}) {
    this.urt4.cmd('com fs_restart');
    return `^3Configurations updated successfully`;
  }

  async ['ANY map <name>: Set a map / show current map (from chat only!)'](arg) { return await this.setMap(arg); }
  async ['ANY+ setmap <name>: Set a map / show current map'](arg) { return await this.setMap(arg); }

  async setMap({as, blames, args: [name]}) {
    const {$players} = this;
    if (!name) return `^3Current map is ^5${this.map}`;
    if (as.level < this.admin.$.levels.tmod) return this.admin.$.cmdErrors.access;
    const map = this.findMap(name);
    await this.changeMap(map);
    blames.push(null);
  }

  async gameMaps(filter, mapObjs) {
    const all = this.findAllMaps(filter, mapObjs);
    if (!all.length) throw `^1Error ^3No results found for pattern "^5${filter}^3"`;
    const msg = [`^2Found ^3${all.length}^2 maps${filter ? ` matching "^5${filter}^2"`: ''}`];

    for (let i = 0; i < all.length; i += 3) {
      const slice = all.slice(i, i + 3);
      msg.push(slice.map(obj => ` ^5${obj.id}^2 : ^3${obj.map}`).join(';'));
    }

    return msg;
  }

  async ['ANY+ maplist [<filter>]: Show available maps'](arg) { return await this.mapList(arg); }
  async ['ANY+ maps [<filter>]: Show available maps'](arg) { return await this.mapList(arg); }

  async mapList({args: [filter]}) {
    return await this.gameMaps(filter, this.maps);
  }

  async ['ANY+ gamemaps <game> [<filter>]: Show available maps for specific game mode']({args: [game, filter]}) {
    if (!game) return this.admin.$.cmdErrors.help;

    const modeObj = this.modes[game];
    if (!modeObj) return `^1Error ^3Game mode ^5${game}^3 is not found. Use ^2games^3 to list game modes`;

    return await this.gameMaps(filter, modeObj.mapObjs);
  }

  async ['TMOD+ moon <on|off>: Moon mode']({as, blames, args: [value]}) {
    if (!value) return this.admin.$.cmdErrors.help;
    const {$players} = this;
    const w = this.urt4.getBoolean(value);
    this.urt4.cmd(`com cvar 1 g_gravity ${w ? 100 : 800}`);
    $players.chat(null, `^2Moon mode ^3has been set to ^5${this.urt4.showBoolean(w)}`);
    blames.push(null);
  }

  async ['ANY+ next [<name>]: Set/show next map'](arg) { return await this.nextMap(arg); }
  async ['ANY+ nextmap [<name>]: Set/show next map'](arg) { return await this.nextMap(arg); }

  async nextMap({as, blames, args: [name]}) {
    const {$players} = this;

    if (!name) {
      const [gmode, curmode, nextmap] = await this.urt4.rpcs([
        'com getcvar nodeurt_mode',
        'com getcvar nodeurt_curmode',
        'com getcvar g_nextmap'
      ]);

      if (curmode !== gmode) {
        const obj = this.modes[gmode];
        return `^3Next map is ^5${nextmap}^3 in other game mode: ^5${obj ? obj.desc : gmode || 'unknown'}`;
      }

      return `^3Next map is ^5${nextmap}`;
    }

    if (as.level < this.admin.$.levels.tmod) return this.admin.$.access;

    const map = this.findMap(name);
    await this.setNextMap(map);
    blames.push(null);
  }

  async ['TMOD+ rain <value>: Set 0 -- sunny; 1 -- raining; 2 -- snowing']({as, blames, args: [value]}) {
    if (!value) return this.admin.$.cmdErrors.help;
    const {$players} = this;
    const w = value | 0;
    this.urt4.cmd(`com cvar 1 g_enableprecip ${w}`);
    $players.chat(null, `^2Weather ^3has been set to ^5${w < 1 ? 'sunny' : w > 1 ? 'snowing' : 'raining'}`);
    blames.push(null);
  }

  async ['TMOD+ restart <"map"|"half">: Restart map (default) or half'](args) { return await this.restart(args); }
  async ['TMOD+ dorestart <"map"|"half">: Restart map (default) or half'](args) { return await this.restart(args); }

  async restart({as, blames, args: [what]}) {
    const {$players} = this;
    const w = (what || '').toString().toLowerCase();
    blames.push(null);

    if (!w || w === 'map') {
      $players.chat(null, `^3The map ^5${this.map}^3 is ^2restarting`);
      this.urt4.cmd(`com in map_restart`);
    } else {
      $players.chat(null, `^3The half of map ^5${this.map}^3 is ^2restarting`);
      this.urt4.cmd(`com in restart`);      
    }
  }

  async ['TMOD+ shuffle : Shuffle teams']({as, blames, args}) {
    const {$players} = this;
    this.urt4.cmd(`com in shuffleteams`);
    $players.chat(null, `^2Teams ^3are ^5shuffled`);
    blames.push(null);
  }
}

Mod.preSetsAsc = [
  'g_friendlyfire',
  'g_followstrict',
  'g_gametype',
];

Mod.preSetsRating = Mod.invert(Mod.preSetsAsc);

Mod.rxCrLf = /[\r\n]+/;
Mod.rxMapCmd = /^(map|devmap|spmap|spdevmap)\s+([\S\s]+)$/;
Mod.rxModCmd = /^(setlevel|list|cycle|game|games|fs|setmap|maplist|maps|next|nextmap)\b/;
Mod.rxModeSep = /[^\w\.\-]+/;
Mod.rxSetting = /^(\w+)\s+(\S+)/;

module.exports = Mod;
