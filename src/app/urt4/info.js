const {$, Emitter} = require('clasync');
const os = require('os');
const fs = require('fs');

class Info extends Emitter {
  async init(deps) {
    const ifaces = os.networkInterfaces();

    const wan = this.$.flatten(Object.values(ifaces)).filter((iface) => (
      iface.family === 'IPv4' &&
      !iface.internal &&
      !/^192\.|^10\.|^172\.(1[6-9]|2|3[01])/.test(iface.address)
    ))[0];

    this.ipAddress = wan ? wan.address : '127.0.0.1';

    await deps({
      admin: this.urt4.admin,
      $discordBot: this.$$.$discordBot
    });

    this.urt4.admin.$mod.on('timelimit', this.onTimelimit.bind(this));
  }

  prettyName$(p, i) {
    const escape = this.$discordBot.$.escape;
    return ` ${i != null ? i+1+'. ' : ''}${escape(p.NAME)}${p.AUTH === '---' ? '' : ' : \`' + escape(p.auth) + '\`'}`;
  }

  static interruptReasons = {
    map: 'map change',
    quit: 'server restart',
  };

  async onTimelimit({interrupt}) {
    const chanId = await this.urt4.rpc('com getcvar nodeurt_discordchan');
    const {client} = this.$discordBot;
    if (!client) return;

    const channel = await client.channels.fetch(chanId);
    if (!channel) return;

    const info = await this.getServerInfo();
    if (!info.nextmap) return; // skip final trigger after intermission

    if (!info.playersObj.length && !info.dcDemos.length) return; // do not show empty games

    const msgs = await this.$discordBot.viewServerInfo(info);

    const top = info.playersObj.slice(0, 3).map(this.prettyName).join('\n');

    msgs.push(`Game ${interrupt ? 'interrupted by ' + this.$.interruptReasons[interrupt] : 'finished'}.${
    top.length ? `\nTop 3 Best Players: \n${top}` : ''}`);

    for (const item of msgs) {
      //console.log(item);
      await channel.send(item);
    }
  }

  async getServerInfo(opts = {}) {
    const [nextmode, mode, nextmap, max, maxgame, port, plOut] = await this.urt4.rpcs([
      'com getcvar nodeurt_mode',
      'com getcvar nodeurt_curmode',
      'com getcvar g_nextmap',
      'com getcvar sv_maxclients',
      'com getcvar g_maxgameclients',
      'com getcvar net_port',
      'com rpc players'
    ]);

    const name = this.urt4.noColor(this.urt4.name);
    const map = this.urt4.admin.$mod.map;
    const modeObj = this.urt4.admin.$mod.modes[mode];
    const modeDesc = modeObj ? modeObj.desc : mode || 'unknown';

    const [gameInfo, ...playersInfo] = plOut.substr(0, plOut.length - 1).split(this.$.rxPlayersOut);

    const gameObj = this.$.makeObject(
      gameInfo.split('\n')
      .map(line => line.match(this.$.rxPlayersOutKeyValues))
      .filter(this.$.echo)
      .map(([, key, value]) => ({[key]: value}))
    );

    const {Players, Scores, GameType, MatchMode, WarmupPhase, Map, GameTime} = gameObj;
    this.$.omits(gameObj, 'Map', 'Players', 'Scores', 'GameType', 'MatchMode', 'WarmupPhase');
    gameObj.Next = `${nextmap} - ${nextmode.toUpperCase()}`;

    if (gameObj.GameTime === '00:00:00') delete gameObj.GameTime;

    const playersObj = playersInfo.map((player) => this.$.makeObject(
      player.substr(1).split(' ')
      .map(ent => ent.match(this.$.rxPlayersKeyValues))
      .filter(this.$.echo)
      .map(([, key, value]) => ({[key]: value}))
    ));

    let playerView = {
      nameLength: 4,
      authLength: 4
    };

    let ratingKeys = [], ratingSort;

    const cdemos = new Set();

    for (const obj of playersObj) {
      const [id, name] = this.$.firstEntry(obj);
      delete obj[id];

      const keys = Object.keys(obj);
      const ipIdx = keys.indexOf('IP');

      if (!ratingSort) {
        ratingKeys = keys.slice(ipIdx + 1);
        if (!ratingKeys.length) ratingKeys = GameType === 'JUMP' ? [] : ['KILLS', 'ASSISTS', 'DEATHS'];
        ratingSort = this.$.makeObject(ratingKeys.map(key => ({[key]: this.$.statPoints[key] || 1})));
      }

      obj.ID = id;
      obj.NAME = name;

      const {$players} = this.urt4.admin;
      const player = $players.clients[obj.ID];

      if (player) {
        const addon = this.$.get(player, 'authInfo', 'addon');
        const lc = opts.color ? $players.getLevelColor(player) : '';

        if (!addon) {
          obj.auth = `${lc}${player.auth || ' '}`;
        } else if (opts.color) {
          obj.auth = $players.prettyAuth(addon, lc);
        } else {
          obj.auth = this.urt4.noColor(addon);
        }
      } else {
        obj.auth = obj.AUTH;
      }

      if (name.length > playerView.nameLength) playerView.nameLength = name.length;
      if (obj.auth.length > playerView.authLength) playerView.authLength = obj.auth.length;

      obj.sortValue = 0;

      for (const [rating, weight] of Object.entries(ratingSort)) {
        obj.sortValue -= obj[rating] * weight;
      }

      obj.demo = $players.getDemoLink(player.demoFile);
      cdemos.add(player.demoFile);
    }

    const playersByTeam = this.$.groupBy(playersObj, 'TEAM');

    for (const players of Object.values(playersByTeam)) {
      players.sort(this.$.objSort('sortValue'));
    }

    playersObj.sort(this.$.objSort('sortValue'));

    const {ipAddress} = this;
    const gametype = this.urt4.admin.$mod.gametype;

    let dcDemos;

    try {
      dcDemos = await $.promisify(fs, 'readdir')(`q3ut4/${this.urt4.curDemoDir}`);
      dcDemos = dcDemos.map(s => s.endsWith('.urtdemo') ? s.substr(0, s.length - 8) : null).filter(v => v && !cdemos.has(v));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      dcDemos = [];
    }

    return {
      playersByTeam, playerView, ratingKeys, ratingSort, ipAddress, port, name,
      nextmode, mode, map, nextmap, max, maxgame, modeDesc,
      gameObj, playersObj, Players, Scores, GameType, gametype,
      MatchMode, WarmupPhase, Map, GameTime, dcDemos, urt4: this.urt4,
    };
  }
}

Info.rxPlayersOut = /(?=\n\d+:)/;
Info.rxPlayersOutKeyValues = /^([^:]+): (.*)$/;
Info.rxPlayersKeyValues = /^([^:]+):([\S\s]*)$/;

Info.statPoints = {
  KILLS: 4,
  ASSISTS: 3,
  DEATHS: -1,

  CAP: 3,
  STC: 3,

  SBM: 3,
  PKB: 0,
  DEF: 3,
  KBD: 1.5
};

module.exports = Info;
