const Cmd = require('./cmd');

class Dbg extends Cmd {
  async init(sub) {
    const {$players} = this.admin;

    const deps = await this.$.all({
      $players
    });
  }

  // CMD

  async trace(
    {as, args: [sEnt1, sEnt2, sContents, sSize, sPassEnt, sCapsule], cte}
  ) {
    if (!sEnt1) {
      return [
        'Contents is plus-separated values:',
        ...this.$.chunk(Object.keys(this.$.contents), 8)
      ];
    }

    const {$players} = this.admin;

    const ents = [
      $players.findEnt(sEnt1, as),
      $players.findEnt(sEnt2, as)
    ];

    const passEnt = sPassEnt ? $players.findEnt(sPassEnt, as) : 1023;
    if (ents[0] < 0 || ents[1] < 0 || passEnt < 0) return '^1Error ^5You\'re not a player';

    const h = (sSize / 2) || 5;
    const bounds = `-${h} -${h} -${h} ${h} ${h} ${h}`;

    const pos = await this.$.all(ents.map(async (ent, index) => {
      if (ent >= 64) {
        const stateStr = await this.urt4.rpc(`sv getent ${ent}`);
        const state = $players.getState(stateStr);
        const pos = state.pos;
        return pos;
      } else {
        const state = await $players.getPlayerState(ent);
        const pos = $players.getPlayerViewPos(state);
        return pos;
      }
    }));

    const contents = !sContents ? -1 : this.urt4.getMask(sContents, this.$.contents);
    const capsule = this.urt4.getBoolean(sCapsule);

    const traced = await this.urt4.rpc(
      `sv trace ${cte} ${this.$.flatten(pos).join(' ')} ${bounds} ${passEnt} ${contents} ${capsule}`
    );

    const [
      all, start, frac, x, y, z, surf, cont, ent,
      nx, ny, nz, dist, type, sign
    ] = traced.split(/\s+/);

    return [
      `^2Trace results:`,
      `^5Fraction: ^3${frac} ; ^5All solid: ^3${all} ; ^5Start solid: ^3${start}`,
      `^5Touchpoint: ^3${x} ${y} ${z} ; ^5Entity: ^3${ent}`,
      `^5Surface: ^3${this.urt4.showMask(surf, this.$.surfaceNames)}`,
      `^5Contents: ^3${this.urt4.showMask(cont, this.$.contentNames)}`,
      `^2Plane. ^5Distance: ^3${dist} ; ^5Normal: ^3${nx} ${ny} ${nz}`
    ];
  }

  async ['ADMIN+ dbgtrace <ent1> <ent2> [<"contents+..."|all>] [<size | 10>] [<passEnt>] [<capsule>] : Trace'](args) {
    return this.trace({...args, cte: 0});
  }

  async ['ADMIN+ dbgtraceent <ent1> <ent2> [<"contents+..."|all>] [<size | 10>] [<ent to trace>] [<capsule>] : Trace'](args) {
    return this.trace({...args, cte: 1});
  }
}

Dbg.contents = {
  none: 0,
  all: -1,
  solid: 1,
  lava: 8,
  slime: 16,
  water: 32,
  fog: 64,
  areaportal: 0x8000,
  playerclip: 0x10000,
  monsterclip: 0x20000,
  mover: 0x800000,
  body: 0x2000000,
  corpse: 0x4000000,
  detail: 0x8000000,
  structural: 0x10000000,
  translucent: 0x20000000,
  trigger: 0x40000000,
  nodrop: 0x80000000
};

Dbg.contentNames = Dbg.invert(Dbg.contents);

Dbg.surfaces = {
  none: 0,
  all: -1,
  nodamage: 1,
  slick: 2,
  sky: 4,
  ladder: 8,
  noimpact: 0x10,
  nomarks: 0x20,
  flesh: 0x40,
  nodraw: 0x80,
  hint: 0x100,
  skip: 0x200,
  nolightmap: 0x400,
  pointlight: 0x800,
  metalsteps: 0x1000,
  nosteps: 0x2000,
  nonsolid: 0x4000,
  lightfilter: 0x8000,
  alphashadow: 0x10000,
  nodlight: 0x20000,
  dust: 0x40000
};

Dbg.surfaceNames = Dbg.invert(Dbg.surfaces);

module.exports = Dbg;
