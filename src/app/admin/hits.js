const Cmd = require('./cmd');

class Hits extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$pos', '$inv', '$players')
    });

    this.frame = 0;

    this.victims = {};
    this.explosions = {};
    this.prevExplosions = {};
    this.healthsAfterDmg = {};
    this.lastAttack = {};
    this.flags = {};
    this.hitProjectiles = {};

    this.sv.on('frame', this.onFrame.bind(this));
    this.$pos.on('ent', this.onEnt.bind(this));
    this.$pos.on('ps', this.onPs.bind(this));

    this.$inv.on('item', this.onItem.bind(this));
    this.$inv.on('flag', this.onFlag.bind(this));
    this.$qvm.on('hit', this.onHit.bind(this));
    this.$qvm.on('kill', this.onKill.bind(this));
  }

  async onFrame() {
    this.frame++;

    if (this.$.hasKeys(this.victims)) {  // somebody injured
      const prevExps = Object.entries(this.prevExplosions);
      const curExps = Object.entries(this.explosions);
      const hitProjs = Object.entries(this.hitProjectiles);

      for (const [id, {hp, ps, prevHp, evt}] of Object.entries(this.victims)) {
        if (!ps) return;
        const pent = this.$pos.ent[id];
        const exps = evt === 17 ? prevExps : curExps;
        const [X1, Y1, Z1] = ps.pos;
        const dmg = prevHp - hp;
        let explCandidates = [];

        for (const [eid, {pos, weapon, owner}] of exps) {  // check explosions
          const [X2, Y2, Z2] = pos;
          const [X, Y, Z] = [X1-X2, Y1-Y2, Z1-Z2];
          const dist = Math.sqrt(X*X + Y*Y + Z*Z);
          const radius = this.$.nadeRadius[weapon];
          if (!radius || dist > radius) continue;
          const attack = {who: owner, weapon, explosion: true, dist, radius, special: true};
          explCandidates.push(attack);
        }

        if (explCandidates.length === 1) {  // if only 1 candidate...
          this.lastAttack[id] = explCandidates[0];  // ... all damage is from it
        } else if (explCandidates.length) {  // if multiple candidates on same frame explosion
          //explCandidates.sort(this.$.objSort('dist'));  // sort by distance
          //this.lastAttack[id] = explCandidates[0];  // choose closest

          // share damage proportionally between each candidate, based on square distance
          let total = 0;
          let closest = explCandidates[0];

          for (const ca of explCandidates) {
            total += (ca.distSqr = ca.dist * ca.dist);
            if (ca.dist < closest.dist) closest = ca;
          }

          total /= dmg;

          //console.log(total, explCandidates);

          for (const ca of explCandidates) {
            const dmg1 = Math.round(dmg - (ca.distSqr / total));
            if (dmg1) await this.emit('hit', {whom: id | 0, prevHp, hp, dmg: dmg1, ...ca});
          }

          closest.bleed = true;
          closest.special = true;
          this.lastAttack[id] = closest;  // bleeding will go on from most powerful candidate

          continue;
        } else {
          const last = this.lastAttack[id];

          if (!last || last.bleed) {
            for (const [eid, {radius, weapon, owner}] of hitProjs) {
              const ent = this.$pos.ent[eid];
              if (!ent) continue;
              const epos = ent.tpos.slice(3, 6);
              const bounds = this.getEntBounds(pent || ps, radius);
              const hit = this.inBounds(bounds, epos);
              //console.log('toss projectile:', radius, this.diffPosAbs(bounds.pos, epos), bounds, epos, hit);
              if (!hit) continue;
              this.lastAttack[id] = {who: owner, weapon, special: true};
              break;
            }
          }
        }

        const attack = this.lastAttack[id];

        if (!attack) {
          this.$.logError('Unidentified attack!');
          continue;
        }

        await this.emit('hit', {whom: id | 0, prevHp, hp, dmg, ...attack});
        attack.special = true;
        attack.bleed = true; // subsequent hit events within same attack is bleeding
      }

      this.victims = {};
    }

    if (this.$.hasKeys(this.explosions)) {
      this.prevExplosions = this.explosions;
      this.explosions = {};
    } else if (this.$.hasKeys(this.prevExplosions)) {
      this.prevExplosions = {};
    }
  }

  getEntBounds(ent, radius) {  // get entity bounding box
    if (!radius) radius = 0;
    if (!ent) return null;
    const pos = ent.tpos ? ent.tpos.slice(3, 6) : ent.pos;
    const mins = (ent.mins || [-15, -15, -15]).map((v, i) => pos[i] + v - radius);
    const maxs = (ent.maxs || [15, 15, 15]).map((v, i) => pos[i] + v + radius);
    const res = {mins, maxs, pos};
    return res;
  }

  inLine(x, X, a) {
    const i = (x <= a) && (a <= X);
    return i;
  }

  inBounds(bounds, pos) {
    const [x,y,z] = bounds.mins;
    const [X,Y,Z] = bounds.maxs;
    const [a,b,c] = pos;
    const i = this.inLine;
    const res = i(x, X, a) && i(y, Y, b) && i(z, Z, c);
    return res;
  }

  insideEnt(ent, pos, radius) {
    const bounds = this.getEntBounds(ent, radius);
    const res = this.inBounds(bounds, pos);
    return res;
  }

  diffPos(p1, p2) {
    const res = p1.map((v, i) => v - p2[i]);
    return;
  }

  diffPosAbs(p1, p2) {
    const res = p1.map((v, i) => Math.abs(v - p2[i]));
    return res;
  }

  async onEnt({id, prev, cur, diff}) {
    // if (diff && diff.event && id == 5) console.log(this.frame, id, diff);

    if (!prev && cur.type[0] === 2 && cur.model[1] === 1 && cur.model[0] in this.$.ctfFlags) { // flag dropped
      const team = cur.model[0];
      let flag = this.flags[team];
      if (!flag) this.flags[team] = flag = {owner: -1};
      flag.ent = id;
      flag.dropped = this.frame;
      return;
    }

    if (!cur && prev.type[0] === 2 && prev.model[1] === 1 && prev.model[0] in this.$.ctfFlags) { // flag returned
      const team = prev.model[0];
      const flag = this.flags[team];
      if (!flag || flag.ent !== id) return;
      flag.pos = prev.tpos.slice(3, 6);
      flag.returned = this.frame;
      return;
    }

    if (!prev && cur.type[0] === 3 && cur.player[1] in this.$.hitProjectiles) { // projectile launched
      const weapon = cur.player[1];
      const owner = cur.relate[4];
      const radius = this.$.hitProjectiles[weapon];
      this.hitProjectiles[id] = {weapon, owner, radius};
      return;
    }

    if (!cur && this.hitProjectiles[id]) { // projectile eliminated
      delete this.hitProjectiles[id];
    }

    const evt = this.$.get(cur, 'event', 2) & 255;

    if (evt === 55) { // something exploded
      let weapon = cur.player[1];
      let owner = cur.relate[4];
      const {pos} = cur;

      if (owner < 0) {  // explosions from flags have no owner info
        for (const [team, flag] of Object.entries(this.flags)) {
          if (flag.ent < 64) {  // player holds
            const i = this.insideEnt(this.$pos.ps[flag.ent], cur.pos);
            if (!i) continue;
          } else {  // if dropped
            let {pos} = flag;  // flag position before elimination

            if (!pos) {  // race: if not yet elimintated
              const ent = this.$pos.ent[flag.ent];
              pos = ent && ent.tpos.slice(3, 6);
            }

            if (pos) { // if dropped
              if (cur.pos.findIndex((v, i) => v !== pos[i]) >= 0) continue;
            } else {
              this.$.logError('Can\'t detect whose flag exploded!');
              continue;
            }
          }

          weapon = -team;
          owner = flag.owner;
          break;
        }
      }

      if (owner < 0) weapon = -4;  // if still no owner, assume it's admin's nuke

      this.explosions[id] = {pos, weapon, owner};
      // console.log('exp', this.frame);
      return;
    }

    let hp = this.$.get(this.$pos.ps, id, 'stats', 6);

    switch (evt) {
      case 17: hp = 0;  // dead
      case 16: {
        /*const last = this.lastAttack[id];

        if (!last || last.bleed) {  // if no fresh attack, check toss from projectile
          for (const [eid, {radius, weapon, owner}] of Object.entries(this.hitProjectiles)) {
            const ent = this.$pos.ent[eid];
            if (!ent) continue;
            const epos = ent.tpos.slice(3, 6);
            const bounds = this.getEntBounds(cur, radius);
            const hit = this.inBounds(bounds, epos);
            console.log('toss projectile:', radius, this.diffPosAbs(bounds.pos, epos), bounds, epos, hit);
            if (!hit) continue;
            this.lastAttack[id] = {who: owner, weapon, special: true};
          }
        }*/
      } break  // wounded

      case 59: {
        if (!this.lastAttack[id]) this.lastAttack[id] = {who: id, weapon: -6, world: true, special: true};
      } break;  // water drowning

      case 49: {
        if (!this.lastAttack[id]) this.lastAttack[id] = {who: id, weapon: -5, world: true, special: true};
      } break;  // fell

      case 99: {  // unidentified injury after jumping is assumed as falling
        if (!this.lastAttack[id]) this.lastAttack[id] = {who: id, weapon: -5, world: true, special: true};
      } break;

      default: hp = null;  // other events are not related to injury
    }

    // TODO: HK-69 nade hit; Slap; Fall with jump held -- currently they are credited to last attacker of falling

    if (hp != null) {
      const prevHp = this.healthsAfterDmg[id];
      if (prevHp === hp) return; // no injury if hp is the same

      // somebody injured
      this.healthsAfterDmg[id] = hp;
      this.victims[id] = {prevHp, hp, ps: this.$pos.ps[id], evt};
      // console.log('dmg', this.frame);
      return;
    }
  }

  async onPs({id, prev, cur, diff}) {
    //if (id === 5 && diff) console.log(this.frame, id, diff);

    const hp = this.$.get(cur, 'stats', 6);

    if (hp != null) { // player hp changed
      const prevHp = this.healthsAfterDmg[id];

      if (prevHp == null || hp > prevHp) { // inital health
        this.healthsAfterDmg[id] = hp;
        delete this.lastAttack[id]; // clear last attack on respawn or heal
      }
    }

    /*if (prev && cur && (prev.stats[9] & 256) && !(cur.stats[9] & 256)) {
      delete this.lastAttack[id];
    }*/
  }

  async onItem({client, item}) {
    if (!(item in this.$.ctfFlags)) return;
    this.flags[item] = {owner: client, ent: client}; // flag taken
  }

  async onFlag({client, event, item}) {
    if (event === 0 && !this.flags[item]) { // flag dropped after mod restarted while flag held
      this.flags[item] = {owner: client};
    }
  }

  async onHit({who, whom, body, weapon}) { // standard hit
    this.lastAttack[whom] = {who, weapon};
  }

  async onKill({who, whom, mod}) {
    const weapon = this.$.modWeapons[mod];
    if (!weapon) return;

    // special hits, caused deaths
    if (who === 1022) who = whom; // kill by world means self kill

    this.lastAttack[whom] = {
      who, weapon,
      world: this.$.worldWeapons[weapon], special: true
    };
  }
}

Hits.entPlayer = {
  weapon: 1
};

Hits.entRelate = {
  owner: 4
};

Hits.nadeRadius = {
  '-1': 310,
  '-2': 310,
  '-4': 310,
  7: 310,
  11: 243,
  16: 2000
};

Hits.weaponNames = {
  '-1': 'Red flag',
  '-2': 'Blue flag',
  '-4': 'Nuke missile',
  '-5': 'Falling',
  '-6': 'Water',
  '-7': 'Suicide',
  '-8': 'Curb-stomp',
  1: 'Knife',
  2: 'Beretta',
  3: 'Desert Eagle',
  4: 'SPAS',
  5: 'MP-5',
  6: 'UMP-45',
  7: 'HK69 nade',
  8: 'LR-300',
  9: 'G-36',
  10: 'PSG-1',
  11: 'HE nade',
  12: 'Flash nade',
  13: 'Smoke nade',
  14: 'SR-8',
  15: 'AK-103',
  16: 'Bomb',
  17: 'Negev',
  18: 'Frag nade',
  19: 'M-4',
  20: 'Glock',
  21: 'Colt-1911',
  22: 'MAC-11',
  23: 'FR-F1',
  24: 'Benelli',
  25: 'P-90',
  26: 'Magnum',
  27: 'TOD-50',
  29: 'Boot kick',
  30: 'Flying knife',
};

Hits.modWeapons = {
  1: -6,
  6: -5,
  7: -7,
  48: -8,
};

Hits.worldWeapons = {
  '-5': true,
  '-6': true,
};

Hits.ctfFlags = {
  1: 'red',
  2: 'blue'
};

Hits.hitProjectiles = {
  7: 30
};

module.exports = Hits;
