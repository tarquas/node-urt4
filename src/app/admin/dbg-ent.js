const Cmd = require('./cmd');
const m3d = require('math3d');

class DbgEnt extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$pos', '$inv', '$players')
    });

return;

    this.frame = 0;
    this.healths = {};

    this.sv.on('frame', this.onFrame.bind(this));
    this.$pos.on('ent', this.onEnt.bind(this));
    this.$pos.on('ps', this.onPs.bind(this));
  }

  async onFrame() {
    //this.hpDiff = {};
    this.frame++;
  }


  transform(from, to) {
    const t1 = new m3d.Transform();
    t1.translate(new m3d.Vector3(...this.parse3p(from.P, from.R)));
    t1.rotate(...this.parse3a(from.A));
    t1.translate(new m3d.Vector3(...this.parse3p(to.P)));
    t1.rotate(...this.parse3a(to.A));

    const result = {
      P: this.make3p(t1.position.values, to.R),
      A: this.make3a(t1.rotation.eulerAngles)
    };

    return result;
  }

  getProjectileInit(pos, ang, view) {
    const t = new m3d.Transform();
    t.translate(new m3d.Vector3(pos[1], pos[2] + view, pos[0]));
    t.rotate(...ang);
    t.translate(new m3d.Vector3(0, 0, 14));
    const v = t.position.values;
    const at = [v[2], v[0], v[1]];
    return at;
  }

  async onEnt({id, prev, cur, diff}) {
    if (id >= 900) return;

    if (!prev && cur.type[0] === 3) {
      this.urt4.cmd(`sv ent ${id} player 0 13 0 0`);
    }

    /*if (!prev) { // && cur.type[0] === 3) {
      console.log(this.frame, 'Enew', id, cur);
    }

    if (cur && cur.type[0] === 2 && cur.model[0] === this.$inv.$.items.ut_weapon_grenade_he) console.log(this.frame, `he`, id, diff);
    if (!cur && prev.type[0] === 2 && prev.model[0] === this.$inv.$.items.ut_weapon_grenade_he) console.log(this.frame, `he del`, id, diff);

    return;*/

    if (diff && cur.type[0] != 17) {
      console.log(this.frame, 'Edif', id, diff);
    }

    if (!prev) {
      console.log(this.frame, 'Enew', id, cur);
    }

    if (!cur) {
      console.log(this.frame, 'Edel', id, prev);
    }

    return;

    //console.log('\n-----\nent', id, state);

    const obj = this.$players.getState(state);

    if (obj.type[0] === 2 && obj.model in {1: 1, 2: 2}) this.$players.chat(null, `flag ${id} @ ${obj.pos}`);

    const ev = obj.event;
    if (!ev) return;

    if (ev[2] === 272) {
      //this.hpDiff.aaa = 1;
    }

    else if (ev[2] === 311) {
      this.$players.chat(null, `^5Explosion ${id} @ ${obj.pos}`);

      for (const [c, diff] of Object.entries(this.hpDiff)) {
        const p = this.$players.clients[c];
        if (!p) continue;

        if (diff > 0) this.$players.chat(null, `^2 - ${this.$players.ncname(p)} +${diff}`);
        else this.$players.chat(null, `^1 - ${this.$players.ncname(p)} ${diff}`);
      }
    }
  }

  async onPs({id, prev, cur, diff}) {

    let w;
    if (diff && (w = diff.weapons)) {
      const dec = w.map(wp => this.$inv.decodeWeapon(wp));
      const he = dec.find(wp => wp.weapon === this.$inv.$.weapons.ut_weapon_grenade_he) || {ammo: 0};
      const hk = dec.find(wp => wp.weapon === this.$inv.$.weapons.ut_weapon_hk69) || {ammo: 0};
      console.log(this.frame, 'Pdif', id, he.ammo, hk.ammo, cur.pos);
    }
    if (diff && (w = diff.weapon)) {
      console.log(this.frame, 'Pwep', id, cur.weapon);
    }

    return;

    if (diff) {
      console.log(this.frame, 'Pdif', id, diff);
    }

    if (!prev) {
      console.log(this.frame, 'Pnew', id, cur);
    }

    if (!cur) {
      console.log(this.frame, 'Pdel', id, prev);
    }

    return;

    //console.log('\n-----\nps', client, state);
    /*
    const obj = this.$players.getState(state);
    let prev = this.healths[client];

    const cur = obj.stats[6];
    this.healths[client] = cur;

    if (prev == null) return;
    if (prev === cur) return;

    const diff = cur - prev;
    this.hpDiff[client] = diff;

    const p = this.$players.clients[client];
    if (!p) return;

    if (diff > 0) this.$players.chat(null, `^2${this.$players.ncname(p)} +${diff}`);
    else this.$players.chat(null, `^1${this.$players.ncname(p)} ${diff}`);
    */
  }
}

module.exports = DbgEnt;
