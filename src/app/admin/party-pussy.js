const Party = require('./party-ctf');

class PartyPussy extends Party {
  defResources() {
    const res = {
      ...super.defResources(),
    };

    return res;
  }

  putDancers() {
    super.putDancers();
  }

  async partyDance(scene) {
    await super.partyDance(scene);
  }

  putTree() {
    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;

    this.urt4.cmds([
      `sv ent 1010 type 4 0 model 253 0 pos ${X} ${Y-1} ${Z+12} ang 0 90 0 light 5 5 5 5 link 1`,
      `sv ent 1011 type 4 0 model 255 0 pos ${X} ${Y} ${Z+9} ang -10 90 0 light 5 5 5 5 link 1`,
      `sv ent 1012 type 4 0 model 255 0 pos ${X} ${Y} ${Z+6} ang -10 90 0 light 5 5 5 5 link 1`,
      `sv ent 1013 type 4 0 model 255 0 pos ${X} ${Y} ${Z+3} ang -10 90 0 light 5 5 5 5 link 1`,
      `sv ent 1014 type 4 0 model 255 0 pos ${X} ${Y} ${Z+0} ang -10 90 0 light 5 5 5 5 link 1`,
      `sv ent 1015 type 4 0 model 255 0 pos ${X} ${Y} ${Z-3} ang -10 90 0 light 5 5 5 5 link 1`,
    ]);
  }
}

PartyPussy.music = {
  ...Party.music,
  elizee: {file: 'sound/pussyparadise/lolita_laf.wav', length: 60000, beat: 400},
};

PartyPussy.mapParams = {
  ...Party.mapParams,
  ut_pussyparadise: {pos: [262, -568, 40], music: 'elizee'}
};

PartyPussy.text = {
  ...Party.text,
  welcome: '^5Welcome ^3to the ^6WE LOVE SEX ^1party^6!',
};

PartyPussy.dancers = {
  ...Party.dancers,
  ent: 24,
  specPos: [-45, 130, 10],
  specAng: [14, -78, 0],
  lightEnt: 1000,
  type: [1, 0],
  flags: 0,
  pos: [[100, -20, 0], [-93, -20, 0], [-45, 100, 0], [-100, -5, 0], [93, -5, 0]],
  ang: [[0, 90, 0], [0, 90, 0], [0, 90, 0], [0, -45, 0], [0, -45, 0]],
  model: [[1, 2], [2, 0], [1, 1], [2, 3], [1, 0]],
  player: Array(5).fill([64+32768, 0]),

  playerEnts: [
    `n\\Sveta\\t\\2\\r\\1\\tl\\1\\f0\\ponybl\\f1\\\\f2\\\\a0\\0\\a1\\255\\a2\\0`,
    `n\\Nata\\t\\2\\r\\0\\tl\\3\\f0\\blonde\\f1\\\\f2\\\\a0\\0\\a1\\0\\a2\\255`,
    `n\\Vasya\\t\\1\\r\\0\\tl\\0\\f0\\arab\\f1\\\\f2\\\\a0\\255\\a1\\0\\a2\\0`,
    `n\\Petya\\t\\1\\r\\2\\tl\\2\\f0\\spikeyor\\f1\\\\f2\\\\a0\\255\\a1\\255\\a2\\0`,
    `n\\Tanya\\t\\1\\r\\1\\tl\\1\\f0\\ponyrd\\f1\\\\f2\\\\a0\\255\\a1\\0\\a2\\255`,
  ],
};

module.exports = PartyPussy;
