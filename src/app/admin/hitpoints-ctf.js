const Cmd = require('./cmd');

class HitpointsCtf extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$players', '$pos', '$qvm', '$hits', '$hitpoints')
    });

    this.onGame();

    this.$players.on('team', this.onTeam.bind(this));
    this.$pos.on('ps', this.onPs.bind(this));
    this.$pos.on('ent', this.onEnt.bind(this));
    this.$qvm.on('game', this.onGame.bind(this));
    this.$qvm.on('spawn', this.onSpawn.bind(this));
    this.$hits.on('hit', this.onHit.bind(this));
    this.$hits.on('flag', this.onFlag.bind(this));
    this.$hitpoints.on('roundOptions7', this.onRoundOptions.bind(this));
    this.$hitpoints.on('killpointOptions7', this.onKillpointOptions.bind(this));
  }

  static makeFlagstats() {
    return {
      dist: this.$.make(),
      totalDist: 0,
    };
  }

  resetFlagstats(team) {
    if (team) {
      this.flagstats[team] = this.$.makeFlagstats();
      return;
    }

    this.flagstats = {
      1: this.$.makeFlagstats(),
      2: this.$.makeFlagstats(),
    };
  }

  resetCtfStats(player) {
    const now = +new Date();

    player.ctfStats = {
      joinedAt: now,
      lastPos: null,
      totalDistance: 0,
      totalMovements: 0,
      lifetime: 0
    };
  }

  onGame() {
    this.flagEnt = {1: null, 2: null};
    this.flagFrom = {1: null, 2: null};
    this.resetFlagstats();
  }

  async onTeam({client, player, team}) {
    if (player.ctfStats) return;
    this.resetCtfStats(player);
  }

  async onSpawn({client}) {
    const p = this.$players.clients[client];
    if (!p) return;
    if (p.ctfStats) p.ctfStats.lastPos = null;
  }

  async onHit({who, whom, hp}) {
    if (hp) return;
    const p = this.$players.clients[who];
    if (!p) return;
    this.$.set(p, 'ctfStats', 'lastPos', null);
    const pos = this.$pos.ps[whom].pos;
    //<
  }

  onRoundOptions({ro, whom}) {
    ro.allyTimePivot = this.$.allyTimePivot;
    ro.killerBonus = this.$.killerBonus;
    ro.allyBonus = this.$.allyBonus;
  }

  onKillpointOptions({ro, ko, dmg, who, whom, ally}) {
    
  }

  async onFlag({client, action, team}) {
    // this.flagstats
  }

  async onPs({id, prev, cur, diff}) {
    // track flag carrier
    if (!cur) return;

    for (const flag in this.flagEnt) {
      if (cur.itemInfo[flag] == null) continue;
      // if (this.flagEnt[flag] === id) continue;
      this.flagEnt[flag] = id;
      this.flagFrom[flag] = cur.pos;
    }
  }

  async onEnt({id, prev, cur, diff}) {
    // track flag pos
    if (!cur) return;
    if (cur.type[0] !== 2) return;
    const flag = cur.model[0];
    if (!(flag in this.flagEnt)) return;
    // if (this.flagEnt[flag] === id) return;
    if (cur.event[0] & 1) return; //invisibile
    this.flagEnt[flag] = id;
    this.flagFrom[flag] = cur.pos;
  }
}

HitpointsCtf.allyTimePivot = 0.5;
HitpointsCtf.killerBonus = 2;
HitpointsCtf.allyBonus = 2;

module.exports = HitpointsCtf;
