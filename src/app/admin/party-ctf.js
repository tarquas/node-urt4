const Party = require('./party');

class PartyCtf extends Party {
  getPartyParams(map) {
    const pp = super.getPartyParams(map);
    //pp.music = this.$.music.jinglebells;
    return pp;
  }

  defResources() {
    const res = {
      ...super.defResources(),
      [32 + 255]: `models/weapons2/grenade/grenade.md3`,
      [32 + 254]: `models/weapons2/flash/flash.md3`,
      [32 + 253]: `models/ammo/grenade1.md3`,
      [32 + 252]: `models/flags/droogs_flag.md3`,
    };

    return res;
  }

  async putTree() {
    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;

    this.urt4.cmds([
      `sv ent 1010 type 4 0 model 255 0 pos ${X-17} ${Y+9} ${Z+8} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1011 type 4 0 model 253 0 pos ${X} ${Y+18} ${Z+10} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1012 type 4 0 model 255 0 pos ${X+16} ${Y+12} ${Z} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1013 type 4 0 model 255 0 pos ${X+17} ${Y-9} ${Z+8} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1014 type 4 0 model 253 0 pos ${X} ${Y-18} ${Z+10} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1015 type 4 0 model 255 0 pos ${X-16} ${Y-12} ${Z} ang 0 90 0 light 5 5 5 5 link 1`,
    ]);

    this.urt4.cmds([
      `sv ent 1009 type 4 0 model 254 0 pos ${X-23} ${Y+23} ${Z-26} ang 0 45 0 light 5 5 5 5 link 1`,
      `sv ent 1008 type 4 0 model 254 0 pos ${X+23} ${Y-23} ${Z-26} ang 0 45 0 light 5 5 5 5 link 1`,
      `sv ent 1007 type 4 0 model 254 0 pos ${X-23} ${Y-23} ${Z-26} ang 0 45 0 light 5 5 5 5 link 1`,
      `sv ent 1006 type 4 0 model 254 0 pos ${X+23} ${Y+23} ${Z-26} ang 0 45 0 light 5 5 5 5 link 1`,

      `sv ent 999 type 4 0 model 252 0 pos ${X} ${Y} ${Z+35} ang 0 90 0 link 1`,
      `sv ent 998 type 4 0 model 253 0 pos ${X} ${Y} ${Z-30} mins -158 -65 -20 maxs 107 200 0 ang 0 0 0 solid -1 0 link 1`,
    ]);

    super.putTree();

    this.flashRot = 0;
  }

  putDancers() {
    super.putDancers();
    const pp = this.partyParams;
    const b = pp.base;
    const d = this.$.dancers;
    let e = d.ent;
    let pe = 544 + e;

    this.urt4.cmds([
      ...this.$.dancers.pos.map((v, i) => (
        `sv ps ${e++} pos ${v.map((x, j) => x + b[j]).join(' ')} ang ${d.ang[i].join(' ')} velo 0 0 0 view 38`
      )),
      ...this.$.dancers.playerEnts.map((v, i) => (
        `sv cfg ${pe++} ${v}`
      )),
    ]);
  }

  async partyDance$(scene) {
    await super.partyDance$(scene);
    if ((this.flashRot += 5) >= 180) this.flashRot = -180;
    const r = this.flashRot;

    this.urt4.cmds([
      `sv ent 1009 ang -60 -35 ${r}`,
      `sv ent 1008 ang -120 -45 ${r}`,
      `sv ent 1007 ang -60 35 ${-r}`,
      `sv ent 1006 ang -120 45 ${-r}`,
    ]);
  }

  async endScene$() {
    await super.endScene();
    const d = this.$.dancers;
    this.urt4.cmds(d.pos.map((pos, i) => `sv ent ${d.ent + i} type 0 0 link 0`));
  }
}

PartyCtf.mapParams = {
  ...Party.mapParams,
  //ut4_tohunga_b8: {pos: [-1290, 1421, 324], music: 'main'},
  ut4_orbital_sl: null,
  ut4_village: null,
  ut4_abbey: null,
  ut4_uptown: null,
};

PartyCtf.text = {
  ...Party.text,
  welcome: '^5Welcome ^3to the ^6CHRISTMAS ^1PARTY^6!',
};

PartyCtf.dancers = {
  ...Party.dancers,
  ent: 24,
  lightEnt: 1000,
  type: [1, 0],
  flags: 1,
  weapons: [16],
  player: Array(5).fill([64+2048+32768+2, 16]),

  playerEnts: [
    `n\\Vasya\\t\\1\\r\\0\\tl\\0\\f0\\touqrd\\f1\\\\f2\\\\a0\\255\\a1\\0\\a2\\0`,
    `n\\Sveta\\t\\2\\r\\1\\tl\\1\\f0\\touqbl\\f1\\\\f2\\\\a0\\0\\a1\\255\\a2\\0`,
    `n\\Petya\\t\\2\\r\\2\\tl\\2\\f0\\touqbl\\f1\\goggles\\f2\\cigar\\a0\\255\\a1\\255\\a2\\0`,
    `n\\Nata\\t\\2\\r\\0\\tl\\3\\f0\\touqbl\\f1\\blonde\\f2\\\\a0\\0\\a1\\0\\a2\\255`,
    `n\\Tanya\\t\\1\\r\\1\\tl\\1\\f0\\touqrd\\f1\\shades\\f2\\\\a0\\255\\a1\\0\\a2\\255`,
  ],
};

module.exports = PartyCtf;
