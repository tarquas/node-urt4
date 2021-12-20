const {Web} = require('clasync');

class Info extends Web.Rest {
  async init(deps) {
    this.serverInfo = new WeakMap();
  }

  async updateServerInfo(urt4) {
    const info = await urt4.$info.getServerInfo({color: true});

    this.$.omits(info,
      'playersObj', 'playerView',
      'ratingKeys', 'ratingSort',
      'urt4', 'dcDemos',
    );

    for (const [team, players] of Object.entries(info.playersByTeam)) {
      for (const player of players) {
        this.$.omits(player,
          'TEAM', 'IP', 'sortValue'
        );
      }
    }

    this.serverInfo.set(urt4, info);
    return info;
  }

  async getServersInfo(mode) {
    const reply = [];

    for (const urt4 of Object.values(this.$$.urt4s)) {
      if (mode && !mode(urt4)) continue;
      const updateServerInfo = this.$.bindOnce(urt4, this, this.updateServerInfo, urt4);
      const pending = this.$.throttleMap.has(updateServerInfo);
      const serverInfo = this.$.timeThrottle(true, this.$.serverInfoThrottle, updateServerInfo);
      if (!pending) await serverInfo;
      const result = this.serverInfo.get(urt4);
      reply.push(result);
    }

    return reply;
  }

  async ['GET /info']({query: {server}, res}) {
    const modeTest = this.$.modeTest[server];

    if (!modeTest) {
      res.status(404);
      return {error: 'bad value of "server" parameter'};
    }

    const result = this.getServersInfo(modeTest);
    return result;
  }
}

Info.serverInfoThrottle = 10000;

Info.modeTest = {
  frag: urt4 => urt4.admin.$mod.gametype != 9,
  jump: urt4 => urt4.admin.$mod.gametype == 9
};

module.exports = Info;
