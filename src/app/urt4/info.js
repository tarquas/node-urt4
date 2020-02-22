const {Emitter} = require('clasync');
var os = require('os');

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

    this.urt4.admin.$qvm.on('timelimit', this.onTimelimit.bind(this));
  }

  async onTimelimit() {
    const chanId = await this.urt4.rpc('com getcvar nodeurt_discordchan');
    const {client} = this.$discordBot;
    if (!client) return;

    const channel = client.channels.get(chanId);
    if (!channel) return;

    const info = await this.getServerInfo();
    if (!info.nextmap) return; // skip final trigger after intermission

    const msgs = await this.$discordBot.viewServerInfo(info);

    msgs.push(`Top 3 Best Players: \n${
      info.playersObj
      .slice(0, 3)
      .map((p, i) => ` ${i+1}. ${p.NAME}${p.AUTH === '---' ? '' : ' : ' + p.auth}`)
      .join('\n')
    }`);

    for (const item of msgs) {
      //console.log(item);
      await channel.send(item);
    }
  }

  async getServerInfo() {
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

      const player = this.urt4.admin.$players.clients[obj.ID];
      obj.auth = !player ? obj.AUTH : this.urt4.noColor(this.$.get(player, 'authInfo', 'addon') || player.auth || ' ');

      if (name.length > playerView.nameLength) playerView.nameLength = name.length;
      if (obj.auth.length > playerView.authLength) playerView.authLength = obj.auth.length;

      obj.sortValue = 0;

      for (const [rating, weight] of Object.entries(ratingSort)) {
        obj.sortValue -= obj[rating] * weight;
      }
    }

    const playersByTeam = this.$.groupBy(playersObj, 'TEAM');

    for (const players of Object.values(playersByTeam)) {
      players.sort(this.$.objSort('sortValue'));
    }

    playersObj.sort(this.$.objSort('sortValue'));

    const {ipAddress} = this;
    const gametype = this.urt4.admin.$mod.gametype;

    return {
      playersByTeam, playerView, ratingKeys, ratingSort, ipAddress, port, name,
      nextmode, mode, map, nextmap, max, maxgame, modeDesc,
      gameObj, playersObj, Players, Scores, GameType, gametype,
      MatchMode, WarmupPhase, Map, GameTime
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
