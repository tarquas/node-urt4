const Cmd = require('./cmd');

class Hitpoints extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$players', '$mod', '$pos', '$qvm', '$hits')
    });

    this.$players.on('team', this.onTeam.bind(this));
    this.$qvm.on('game', this.onGame.bind(this));
    this.$qvm.on('spawn', this.onSpawn.bind(this));
    this.$hits.on('hit', this.onHit.bind(this));
    this.$players.on('scores', this.onScores.bind(this));
  }

  onGame() {
    for (const [c, p] of Object.entries(this.$players.clients)) {
      p.hitstats = {kills: 0, deaths: 0, assists: 0};
      delete p.hitpoints;
    }
  }

  onScores({player, client, viewerPlayer, viewerClient, scores}) {
    const hs = player.hitstats;
    if (!hs) return;

    const testHitstats = this.urt4.getBoolean(this.$.get(viewerPlayer, 'prefs', 'testHitstats'));
    if (!testHitstats) return;

    const testSpecOnly = this.urt4.getBoolean(this.$.get(viewerPlayer, 'prefs', 'testSpecOnly'));
    if (testSpecOnly && this.$.get(viewerPlayer, 'info2', 't') != 3) return;

    scores[0] = Math.round(hs.kills);
    scores[4] = Math.round(hs.deaths);
    scores[9] = Math.round(hs.assists);
  }

  isTestKillpointsFor(c) {
    const p = this.$players.clients[c];
    if (!p) return;
    const testKillpoints = this.urt4.getBoolean(this.$.get(p, 'prefs', 'testKillpoints'));
    return testKillpoints;
  }

  reportKillpoints(p, text) {
    const c = p.client;

    const followers = this.$pos.getFollowers(c);
    if (!followers) return;

    const testSpecOnly = this.urt4.getBoolean(this.$.get(p, 'prefs', 'testSpecOnly'));

    const all = [...[testSpecOnly ? [] : c], ...followers].filter(c => this.isTestKillpointsFor(c));
    if (!all.length) return;

    this.$players.chat(all, text);
  }

  async onTeam({client, player: p}) {
    const now = +new Date();

    p.hitpoints = {
      spawnedAt: now,
      enemyHits: this.$.make(),
      allyHits: this.$.make(),
      damaged: 0
    };

    if (!p.hitstats) p.hitstats = {
      kills: 0,
      deaths: 0,
      assists: 0,
    };
  }

  async onSpawn({client}) {
    const p = this.$players.clients[client];
    if (!p) return;

    const whomName = `^5${this.$players.name(p)}`;

    const hpt = p.hitpoints;

    if (hpt && hpt.diedAt) {
      const now = +new Date();
      const roundTime = now - hpt.spawnedAt;
      const deadTime = now - hpt.diedAt;
      const deadRatio = deadTime / roundTime;
      const aliveRatio = 1 - deadRatio;
      const deadFactor = deadRatio / hpt.damaged;
      const aliveFactor = aliveRatio / hpt.damaged;

      const {gametype} = this.$mod;

      let allyTimePivot = this.$.allyTimePivots[gametype];
      if (allyTimePivot == null) allyTimePivot = this.$.allyTimePivots.default;

      let killerBonus = this.$.killerBonuses[gametype];
      if (killerBonus == null) killerBonus = this.$.killerBonuses.default;

      for (const [c, dmg] of Object.entries(hpt.enemyHits)) {
        const killpoints = (deadFactor * dmg) * (hpt.killer == c ? killerBonus : 1);

        const kp = `^${killpoints < 0 ? 1 : 2}${killpoints.toFixed(3)}^3 killpoints`;
        const P = this.$players.clients[c];
        if (!P || !P.hitpoints) continue;

        P.hitstats.kills += killpoints;
        p.hitstats.deaths += killpoints;

        this.reportKillpoints(P, `^3You've got ${kp} for enemy ${whomName}`);
        this.reportKillpoints(p, `^5${this.$players.name(P)} got ${kp} for ^5you`);
      }

      for (const [c, dmg] of Object.entries(hpt.allyHits)) {
        const killpoints = (
          (aliveRatio - aliveFactor * allyTimePivot * dmg - allyTimePivot) *
          (hpt.killer == c ? killerBonus : 1)
        );

        const kp = `^${killpoints < 0 ? 1 : 2}${killpoints.toFixed(3)}^3 killpoints`;
        const P = this.$players.clients[c];
        if (!P || !P.hitpoints) continue;

        P.hitstats.kills += killpoints;
        P.hitstats.assists += killpoints;

        if (p === P) {
          this.reportKillpoints(p, `^5You've^3 got ${kp} for ^1suicide`);
          continue;
        }

        this.reportKillpoints(P, `^5You've^3 got ${kp} for ally ${whomName}`);
        this.reportKillpoints(p, `^3Ally ^5${this.$players.name(P)}^3 got ${kp} for ^5you`);
      }
    }

    await this.onTeam({client, player: p});
  }

  async onHit({who, whom, dmg, hp}) {
    const p = this.$players.clients[whom];
    if (!p) return;

    const hpt = p.hitpoints;
    if (!hpt) return;

    const h = this.$players.clients[who];
    if (!h) return;

    const isAlly = who == whom || (p.info2.t != 0 && p.info2.t === h.info2.t);
    const hitters = isAlly ? hpt.allyHits : hpt.enemyHits;

    if (!hitters[who]) hitters[who] = dmg;
    hitters[who] += dmg;

    hpt.damaged += dmg;

    if (!hp) {
      hpt.killer = who;
      hpt.diedAt = +new Date();
    }
  }
}

Hitpoints.allyTimePivots = {
  default: 1,
  7: 0.5
};

Hitpoints.killerBonuses = {
  default: 2
};

module.exports = Hitpoints;

/*

player: {
  spawnedAt: Date,
  enemyHits: {clientId: damage},
  allyHits: {clientId: damage},
  damaged: Number,
  killer: clientId,
  diedAt: Date
}

if (player.spawnedAt) {
  isAlly = hitter == player || (player.info2.t != 0 && player.info2.t == hitter.info2.t);
  
}

player.spawnedAt = now;

====
now = +new Date()
roundTime = now - player.spawnedAt
deadTime = now - player.diedAt
deadRatio = deadTime / roundTime
aliveRatio = 1 - deadRatio
deadFactor = deadRatio / player.damaged
aliveFactor = aliveRatio / player.damaged
killerId = player.killer
killerBonus = 2
teamkillerPenalty

allyTimePivot = (
  CTF: 0.5,
  default: 1
)

player.enemyHits: enemyHit
  enemyHit.killpoints = (
    (deadFactor * enemyHit.damage) *
    (killerId == allyHit.clientId ? killerBonus : 1)
  )

player.allyHits: enemyHit
  allyHit.killpoints = (
    (aliveRatio - aliveFactor * allyTimePivot * allyHit.damage - allyTimePivot) *
    (killerId == allyHit.clientId ? killerBonus : 1)
  )

scores:
0:KILLS 1:PING 2:TIME ? 4:DEATHS 0 0 0 0 9:ASSISTS 0


*/
