const Cmd = require('./cmd');

const util = require('util');
const fs = require('fs');
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

class Mod extends Cmd {
  async init() {
    await this.admin.$players;

    this.ignoreMapHook = true;
    this.maps = {};
    this.modes = {};
    this.sets = {};

    this.urt4.com.on('fs_restart', this.onMaps.bind(this));
    this.urt4.sv.on('cfg', this.onCfg.bind(this));
    this.urt4.sv.on('map', this.onMap.bind(this));
    this.urt4.com.on('in', this.onIn.bind(this));
    this.urt4.com.on('cvar', this.onCvar.bind(this));

    this.startup();
  }

  async startup() {
    // get map list and modes
    this.gametypesDir = `${this.urt4.cwd}/q3ut4/gametypes`;
    this.matchSetting = this.matchSettingFunc.bind(this);
    const mapsArr = await this.urt4.rpc('com getmaps ');
    const maps = mapsArr.split('\n');
    maps.shift();
    await this.onMaps({maps});

    // get current map
    await this.onMap({map: await this.urt4.rpc('com getcvar mapname')});
  }

  /*async getModes() {
    this.modes = {};
    this.modeSets = {};
    const modes = await readdir(this.gametypesDir);

    for (const mode of modes) {
      try {
        const descText = await readFile(`${this.gametypesDir}/${mode}/desc.txt`, 'utf8');
        const desc = descText.split(this.$.rxCrLf).join(' ').trim();

        let maps;

        try {
          const mapsText = await readFile(`${this.gametypesDir}/${mode}/mapcycle.txt`, 'utf8');
          maps = mapsText.split(this.$.rxCrLf).map(this.trim).filter(this.notFalsy);
        } catch (err) { maps = []; }

        let sets;

        try {
          const setsText = await readFile(`${this.gametypesDir}/${mode}/set.cfg`, 'utf8');
          const setsItems = setsText.split(this.$.rxCrLf).map(this.trim).filter(this.notFalsy);

          sets = Object.assign({}, ...setsItems
            .map(this.matchSetting)
            .filter(this.notFalsy)
            .map(this.convMatchedObject)
          );
        } catch (err) { sets = {}; }

        const mapObjs = {};
        this.setMaps(maps, mapObjs);

        this.modes[mode] = {sets, maps, mapObjs, desc};
        Object.assign(this.modeSets, sets);
      } catch (err) { }
    }

    if (this.map) await this.onMap({map: this.map});
  }*/

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
      client: -2,
      level: this.admin.$.levels.console,
      allowedCmds: this.admin.modCmds
    };

    const result = await this.admin.execCmd(as, cmd, {blames: []});

    if (result !== this.admin.$.cmdErrors.missing) {
      return this.admin.$players.clCmdResult({cmd, client: -2, result});
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

    const [gametype, mode, name] = await this.urt4.rpcs([
      'com getcvar g_gametype',
      'com getcvar nodeurt_mode',
      'com getcvar sv_hostname'
    ]);

    this.urt4.name = name;
    this.gametype = gametype;

    if (!this.map) {
      await this.modesRestrictedAdjust();
    }

    if (map === 'nomap') {
      return this.setNextMode(mode);
    }

    this.map = map;

    const modeObj = this.modes[mode];

    if (modeObj) {
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
    const {$players} = this.admin;
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
    const {$players} = this.admin;
    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = this.modes[mode];
    const modeDesc = modeObj ? modeObj.desc : 'unknown mode';
    $players.chat(null, `^3Changing map to ^5${map}^3 at ^2${modeDesc}`);
    this.urt4.cmd('com in bigtext "^2Please wait..."');

    await this.$.delay(1000);
    this.urt4.cmd(`com in g_nextmap ${map}`);
    await this.$.delay(1000);

    this.map = map;
    this.urt4.cmd('com in cyclemap');
  }

  // CMD

  async ['TMOD+ cycle : Cycle map'](arg) { return await this.cycleMap(arg); }
  async ['TMOD+ cyclemap : Cycle map'](arg) { return await this.cycleMap(arg); }

  async cycleMap({as, blames, args: [name]}) {
    this.urt4.cmd(`com in cyclemap`);
    blames.push(null);
  }

  async ['ANY+ game [<mode>]: Set next game mode / show current mode']({as, blames, args: [mode]}) {
    const {$players} = this.admin;

    if (!mode) {
      const gmode = await this.urt4.rpc('com getcvar nodeurt_mode');
      const obj = this.modes[gmode];
      return `^3Current game mode is ^5${obj ? obj.desc : 'unknown'}`;
    }

    if (as.level < this.admin.$.levels.tmod) return this.admin.$.cmdErrors.access;

    const modeObj = this.modes[mode];
    if (!modeObj) return `^1Error ^3Mode ^5${mode}^3 not found`;

    if (modeObj.restricted && as.level < this.admin.$.levels.admin) {
      return `^1Error ^3This game mode is restricted by ^1server administrator`;
    }

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
    const {$players} = this.admin;
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
    const {$players} = this.admin;
    const w = this.urt4.getBoolean(value);
    this.urt4.cmd(`com cvar 1 g_gravity ${w ? 100 : 800}`);
    $players.chat(null, `^2Moon mode ^3has been set to ^5${this.urt4.showBoolean(w)}`);
    blames.push(null);
  }

  async ['ANY+ next [<name>]: Set/show next map'](arg) { return await this.nextMap(arg); }
  async ['ANY+ nextmap [<name>]: Set/show next map'](arg) { return await this.nextMap(arg); }

  async nextMap({as, blames, args: [name]}) {
    const {$players} = this.admin;

    if (!name) {
      const nextmap = await this.urt4.rpc(`com getcvar g_nextmap`);
      return `^3Next map is ^5${nextmap}`;
    }

    if (as.level < this.admin.$.levels.tmod) return this.admin.$.access;

    const map = this.findMap(name);
    await this.setNextMap(map);
    blames.push(null);
  }

  async ['TMOD+ rain <value>: Set 0 -- sunny; 1 -- raining; 2 -- snowing']({as, blames, args: [value]}) {
    if (!value) return this.admin.$.cmdErrors.help;
    const {$players} = this.admin;
    const w = value | 0;
    this.urt4.cmd(`com cvar 1 g_enableprecip ${w}`);
    $players.chat(null, `^2Weather ^3has been set to ^5${w < 1 ? 'sunny' : w > 1 ? 'snowing' : 'raining'}`);
    blames.push(null);
  }

  async ['TMOD+ restart <"map"|"half">: Restart map (default) or half'](args) { return await this.restart(args); }
  async ['TMOD+ dorestart <"map"|"half">: Restart map (default) or half'](args) { return await this.restart(args); }

  async restart({as, blames, args: [what]}) {
    const {$players} = this.admin;
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
    const {$players} = this.admin;
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