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

  static makeHitstats() {
    return {
      kills: 0,
      deaths: 0,
      assists: 0,
    };
  }

  resetHitpoints(player) {
    const now = +new Date();

    player.hitpoints = {
      spawnedAt: now,
      enemyHits: this.$.make(),
      allyHits: this.$.make(),
      damaged: 0
    };
  }

  resetHitstats(player) {
    if (player) {
      player.hitstats = this.$.makeHitstats();
      return;
    }

    for (const [c, p] of Object.entries(this.$players.clients)) {
      p.hitstats = this.$.makeHitstats();
      delete p.hitpoints;
    }
  }

  onGame() {
    this.resetHitstats();
  }

  async onTeam({player, teamId}) {
    if (teamId === 'spec') {
      delete player.hitpoints;
      player.active = false;
      player.spectator = true;
      return;
    }

    player.spectator = false;
    this.resetHitpoints(player);
    if (player.hitstats) return;
    this.resetHitstats(player);
  }

  onScores({player, client, viewerPlayer, viewerClient, scores}) {
    const hs = player.hitstats;
    if (!hs) return;

    const testHitstats = this.urt4.getBoolean(this.$.get(viewerPlayer, 'prefs', 'testHitstats'));
    if (!testHitstats) return;

    const testSpecOnly = this.urt4.getBoolean(this.$.get(viewerPlayer, 'prefs', 'testSpecOnly'));
    if (testSpecOnly && this.$.get(viewerPlayer, 'info2', 't') != 3) return;

    const S = this.$.scores;
    scores[S.kills] = Math.round(hs.kills);
    scores[S.deaths] = Math.round(hs.deaths);
    scores[S.assists] = Math.round(hs.assists);
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

  async onSpawn({client}) {
    const p = this.$players.clients[client];
    if (!p) return;

    const whomName = `^5${this.$players.name(p)}`;

    p.active = true;
    const now = +new Date();

    const hpt = p.hitpoints;

    if (hpt && hpt.diedAt) {
      const ro = {};

      ro.now = now;
      ro.roundTime = ro.now - hpt.spawnedAt;
      ro.deadTime = ro.now - hpt.diedAt;
      ro.deadRatio = ro.deadTime / ro.roundTime;
      ro.aliveRatio = 1 - ro.deadRatio;
      ro.deadFactor = ro.deadRatio / hpt.damaged;
      ro.aliveFactor = ro.aliveRatio / hpt.damaged;

      ro.gametype = this.$mod.gametype;

      ro.allyTimePivot = this.$.allyTimePivot;
      ro.killerBonus = this.$.killerBonus;
      ro.allyBonus = this.$.allyBonus;

      const roEvt = `roundOptions${ro.gametype}`;
      const koEvt = `killpointOptions${ro.gametype}`;

      {
        const e = this.emit(roEvt, {ro, whom: p});
        if (e && e.then) await e;
      }

      for (const [c, dmg] of Object.entries(hpt.enemyHits)) {
        const P = this.$players.clients[c];
        if (!P || !P.hitpoints || !P.hitstats) continue;

        const ko = {};

        ko.killpoints = (ro.deadFactor * dmg) * (hpt.killer == c ? ro.killerBonus : 1);

        const e = this.emit(koEvt, {ro, ko, dmg, who: P, whom: p, ally: false});
        if (e && e.then) await e;

        P.hitstats.kills += ko.killpoints;
        p.hitstats.deaths += ko.killpoints;

        const kp = `^${ko.killpoints < 0 ? 1 : 2}${ko.killpoints.toFixed(3)}^3 killpoints`;
        this.reportKillpoints(P, `^3You've got ${kp} for enemy ${whomName}`);
        this.reportKillpoints(p, `^5${this.$players.name(P)} got ${kp} for ^5you`);
      }

      for (const [c, dmg] of Object.entries(hpt.allyHits)) {
        const P = this.$players.clients[c];
        if (!P || !P.hitpoints || !P.hitstats) continue;

        const ko = {};

        ko.killpoints = (
          (ro.aliveRatio - ro.aliveFactor * ro.allyTimePivot * dmg - ro.allyTimePivot) *
          (hpt.killer == c ? ro.killerBonus : 1) *
          ro.allyBonus 
        );

        const e = this.emit(roEvt, {ro, ko, dmg, who: P, whom: p, ally: true});
        if (e && e.then) await e;

        P.hitstats.kills += ko.killpoints;
        P.hitstats.assists += ko.killpoints;

        const kp = `^${ko.killpoints < 0 ? 1 : 2}${ko.killpoints.toFixed(3)}^3 killpoints`;

        if (p === P) {
          this.reportKillpoints(p, `^5You've^3 got ${kp} for ^1suicide`);
          continue;
        }

        this.reportKillpoints(P, `^5You've^3 got ${kp} for ally ${whomName}`);
        this.reportKillpoints(p, `^3Ally ^5${this.$players.name(P)}^3 got ${kp} for ^5you`);
      }
    }

    await this.onTeam({player: p});
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
    else hitters[who] += dmg;

    hpt.damaged += dmg;

    if (hp) return;

    hpt.killer = who;
    hpt.diedAt = +new Date();
    p.active = false;
  }
}

Hitpoints.allyTimePivot = 1;
Hitpoints.killerBonus = 2;
Hitpoints.allyBonus = 2;

Hitpoints.scores = {
  kills: 0,
  ping: 1,
  time: 2,
  deaths: 4,
  assists: 9,
};

module.exports = Hitpoints;

