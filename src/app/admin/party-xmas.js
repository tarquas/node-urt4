const Party = require('./party');

class PartyXmas extends Party {
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
      [32 + 252]: `models/players/funstuff/touqrd_r_1_0.md3`,
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
    ]);

    super.putTree();

    this.flashRot = 0;
  }

  putDancers() {
    super.putDancers();

    this.urt4.cmds([
      `sv cfg ${544+24} n\\Vasya\\t\\1\\r\\0\\tl\\0\\f0\\touqrd\\f1\\\\f2\\\\a0\\255\\a1\\0\\a2\\0`,
      `sv cfg ${544+25} n\\Sveta\\t\\2\\r\\1\\tl\\1\\f0\\touqbl\\f1\\\\f2\\\\a0\\0\\a1\\255\\a2\\0`,
      `sv cfg ${544+26} n\\Petya\\t\\2\\r\\2\\tl\\2\\f0\\touqbl\\f1\\goggles\\f2\\cigar\\a0\\255\\a1\\255\\a2\\0`,
      `sv cfg ${544+27} n\\Nata\\t\\2\\r\\0\\tl\\3\\f0\\touqbl\\f1\\blonde\\f2\\\\a0\\0\\a1\\0\\a2\\255`,
      `sv cfg ${544+28} n\\Tanya\\t\\1\\r\\1\\tl\\1\\f0\\touqrd\\f1\\shades\\f2\\\\a0\\255\\a1\\0\\a2\\255`,
    ]);
  }

  async partyDance(scene) {
    await super.partyDance(scene);
    if ((this.flashRot += 5) >= 180) this.flashRot = -180;
    const r = this.flashRot;

    this.urt4.cmds([
      `sv ent 1009 ang -60 -35 ${r}`,
      `sv ent 1008 ang -120 -45 ${r}`,
      `sv ent 1007 ang -60 35 ${-r}`,
      `sv ent 1006 ang -120 45 ${-r}`,
    ]);
  }

  async endScene() {
    await super.endScene();
    const d = this.$.dancers;
    this.urt4.cmds(d.pos.map((pos, i) => `sv ent ${d.ent + i} type 0 0 link 0`));
  }
}

PartyXmas.text = {
  ...Party.text,
  welcome: '^5Welcome ^3to the ^6New Year ^1party^6!',
};

PartyXmas.dancers = {
  ...Party.dancers,
  ent: 24,
  lightEnt: 1000,
  type: [1, 0],
  player: Array(5).fill([64+2048+32768, 16]),
};

module.exports = PartyXmas;
