const Cmd = require('./cmd');

class Pos extends Cmd {
  async init(deps) {
    this.bounds = [];

    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$players', '$mod', '$qvm')
    });

    //this.sv.on('ent', this.onEnt.bind(this));
    this.$qvm.on('begin', this.onBegin.bind(this));
    this.$mod.on('map', this.onMap.bind(this));
    this.$players.on('team', this.onTeam.bind(this));
    this.sv.on('clcmd', this.onClCmd.bind(this), -1);
    this.onMap({gametype: this.$mod.gametype});

    this.exhaustWorkerBound = this.exhaustWorker.bind(this);
    this.exhaustWorkerBound();
  }

  async exhaustWorker() {
    const {infSta} = this.$mod.sets;
    
    for (const player of Object.values(this.$players.clients)) {
      if (
        !this.$players.clients[player.client] ||
        player.dropped ||
        this.$.get(player, 'info2', 't') === '3'
      ) continue;

      const cap = this.$.get(player, 'pos', 'staminaCap');
      const inf = infSta && !this.$.get(player, 'prefs', 'noInfSta');
      if (cap == null && !inf) continue;

      const state = await this.$players.getPlayerState(player);
      const {player: pi, stats} = state;
      if (pi[this.$.playerIsFollowing]) continue;
      const sta = stats[this.$.statStamina];

      if (cap != null) {
        if (sta > cap) {
          stats[this.$.statStamina] = cap;
          this.$players.setPlayerState(player, {stats});
        }
      } else {
        if (inf) {
          stats[this.$.statStamina] = stats[this.$.statHealth] * this.$.statStaminaMul;
          this.$players.setPlayerState(player, {stats});
        }
      }
    }

    if (!await this.$.isFinal(this)) setTimeout(this.exhaustWorkerBound, 1000);
  }

  async onClCmd(arg) {
    const {cmd, client} = arg;
    const player = this.$players.clients[client];
    if (!player || player.dropped) return 1;

    if (
      this.$mod.sets.saveLoadBind &&
      !this.urt4.getBoolean(this.$.get(player, 'prefs', 'noSaveLoadBind'))
    ) {
      const [, drop] = cmd.match(this.$.rxDropItem) || [];

      switch (drop && drop.toLowerCase()) {
        case 'kevlar':
          arg.cmd = 'save'; break;
        case 'flag':
        case 'medkit':
          arg.cmd = 'load'; break;
      }
    }
  }

  async onTeam({player, onTeam}) {
    if (
      this.$mod.sets.sameResp &&
      !this.urt4.getBoolean(this.$.get(player, 'prefs', 'noSameResp'))
    ) {
      // preserve position on jump map
      const state = await this.$players.getPlayerState(player);
      const pos = this.getPosState(state);
      this.$.set(player, 'pos', 'sameResp', this.$mod.map, pos);

      // show motd
      
    }
  }

  async onBegin({client}) {
    const player = this.$players.clients[client];
    if (!player || player.dropped) return 1;

    if (
      this.$mod.sets.sameResp &&
      !this.urt4.getBoolean(this.$.get(player, 'prefs', 'noSameResp'))
    ) {
      // on respawn, set preserved position on jump map
      const pos = this.$.get(player, 'pos', 'sameResp', this.$mod.map);

      if (pos) {
        this.$players.setPlayerState(player, pos);
        delete this.$.get(player, 'pos', 'sameResp')[this.$mod.map];
      }
    }

    const state = this.$.get(player, 'pos', 'resp', this.$mod.map);
    if (state) this.$players.setPlayerState(player, state);
  }

  async onMap({map, gametype}) {
    const {$: {jumpCmds}, admin: {cmds, $: {levels}}} = this;
    const gmode = await this.urt4.rpc('com getcvar nodeurt_mode');
    const modeObj = this.$mod.modes[gmode];

    const level = this.$.get(modeObj, 'mod', 'posCmds') ? levels.any : levels.sup;

    for (const cmd of jumpCmds) {
      cmds[cmd].level = level;
    }
  }

  async onEnt({id: client, state}) {

  }

  getPosState(state) {
    const pos = this.$.pick(state, this.$.stateProps);
    return pos;
  }

  async regainStamina(p) {
    const {$players} = this.admin;
    const state = await $players.getPlayerState(p);
    const {stats} = state;
    stats[this.$.statStamina] = stats[this.$.statHealth] * this.$.statStaminaMul;
    $players.setPlayerState(p, {stats});
  }

  // CMD

  async ['ADMIN align [<player>] : Align yaw to 32 degrees (for infinite slide bug)']({as, args: [player, who]}) {
    const {$players} = this.admin;
    const p = $players.find(player, as, true);
    const {ang} = await $players.getPlayerState(p);
    const oct = ((ang[1] + 180) / 45) | 0;
    ang[1] = this.$.inStaAlignAngles[oct];
    $players.setPlayerState(p, {ang});
    return `^3You're aligned to infinite slide angle`;
  }

  async ['MOD+ exhaust <player> [<stamina%>] : Limit player stamina']({as, blames, args: [player, sta]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as);

    if (!sta) {
      const e = this.$.get(p, 'pos', 'staminaCap');
      return `^3Player ${this.$players.name(p)}^3 stamina is ^2${e == null ? 'unlimited' : `limited to ${(e / this.$.statStaminaMul) | 0}%`}`;
    }

    const s = sta | 0;
    const w = s >= 100 ? null : s <= 0 ? 0 : s;
    const v = w && w * this.$.statStaminaMul;
    this.$players.set(p, {'pos.staminaCap': v});

    blames.push(p);
    this.$players.chat(null, `^3Player ${this.$players.name(p)}^3 stamina now is ^2${v == null ? 'unlimited' : `limited to ${w}%`}`);
  }

  async [
    'ANY goto <player> [<who>]: Go to position of another player'
  ]({as, blames, args: [player, who]}) {
    const {$players} = this.admin;
    const p = $players.find(player, as);
    const state = await $players.getPlayerState(p);
    const pos = this.getPosState(state);
    const pwho = $players.find(who, as, true);

    if (pwho !== as && as.level < this.admin.$.levels.sup) {
      return `^1Error ^3Only ^6supervisors^3 may teleport other players`;
    }

    $players.setPlayerState(pwho, pos);
    if (pwho === as) return `^3You have come to ^5${$players.name(p)}`;
    blames.push(pwho);
    return `^3You have teleported ^5${$players.name(pwho)}^3 to ^5${$players.name(p)}`;
  }

  async [
    'ANY load [<label>] [<who>]: Loads previously saved position of a map'
  ]({as, blames, args: [label, who]}) {
    const {$players, $mod} = this.admin;

    const l = label || 'default';
    const pwho = $players.find(who, as, true);

    if (pwho !== as && as.level < this.admin.$.levels.sup) {
      return `^1Error ^3Only ^5supervisors^3 may teleport other players`;
    }

    const pos = this.$.get(as, 'pos', 'save', $mod.map, l);
    if (!pos) return `^1Error ^3Label ^5${l}^3 wasn't used as a save point on this map`;
    $players.setPlayerState(pwho, pos);
    await this.regainStamina(pwho);

    if (pwho === as) {
      $players.message(as, `^3loaded from ^5${l}`);
      return;
    }

    blames.push(pwho);
    return `^3You have teleported ^5${$players.name(pwho)}^3 to label ^5${l}`;
  }

  async [
    'ADMIN loc [<loc ID>] [<who>] [<label>]: Loads saved position on specific location / List locations'
  ]({as, blames, args: [loc, who, label]}) {
    const {$players, $mod} = this.admin;

    const l = label || 'default';
    const pwho = $players.find(who, as, true);

    if (pwho !== as && as.level < this.admin.$.levels.sup) {
      return `^1Error ^3Only ^5supervisors^3 may teleport other players`;
    }

    const locs = null; //TODO:

    const pos = this.$.get(as, 'pos', 'save', $mod.map, l);
    if (!pos) return `^1Error ^3Label ^5${l}^3 wasn't used as a save point on this map`;
    $players.setPlayerState(pwho, pos);
    await this.regainStamina(pwho);

    if (pwho === as) {
      $players.message(as, `^3loaded from ^5${l}`);
      return;
    }

    blames.push(pwho);
    return `^3You have teleported ^5${$players.name(pwho)}^3 to label ^5${l}`;
  }

  async ['ANY save [<label>] [<whom>]: Saves a position on a map']({as, args: [label, whom]}) {
    const {$players, $mod} = this.admin;

    const pwhom = $players.find(whom, as, true);
    const state = await $players.getPlayerState(pwhom);
    const pos = this.getPosState(state);
    const l = label || 'default';

    await $players.set(as, {[`pos.save.${$mod.map}.${l}`]: pos}, {raw: true});

    if (pwhom === as) {
      $players.message(as, `^3saved to ^5${l}`);
      return;
    }

    return `^3You have saved position of ${$players.name(pwhom)} to label ^5${l}`;
  }

  async ['ANY regainstamina : Same as ^5sta^3 (for compatibility)'](obj) { return this.sta(obj); }
  async ['ANY sta [<player>]: Regain your stamina'](obj) { return this.sta(obj); }

  async sta({as, blames, args: [player]}) {
    const {$players} = this.admin;
    const p = $players.find(player, as, true);

    if (p !== as && as.level < this.admin.$.levels.sup) {
      return `^1Error ^3Only ^5supervisors^3 may regain stamina of other players`;
    }

    await this.regainStamina(p);
    if (p === as) return `^3You have regained your stamina`;
    blames.push(p);
    return `^3You have regained stamina of ^5${$players.name(p)}`;
  }
}

Pos.inStaAlignAngles = [-180, -90, -90, 0, 0, 90, 90, 180, -180].map((v, i) => i & 1 ? v - 28 : v + 28);
Pos.jumpCmds = ['goto', 'load', 'regainstamina', 'save', 'sta'];

Pos.playerFollows = 4;
Pos.playerIsFollowing = 2;

Pos.solidState = [0x400000, 0x200000];
Pos.stateProps = ['pos', 'ang', 'velo', 'view'];

Pos.statStaminaMul = 300;
Pos.statStamina = 0; // max = health*300
Pos.statHealth = 6;
Pos.statFreeze = 9; //set to 30000 causes freeze, healthbar blinking and changing this val to 28928

Pos.rxTeamCmd = /^team\s+(\S+)$/;
Pos.rxDropItem = /^ut_itemdrop\s+(\S+)$/;

module.exports = Pos;
