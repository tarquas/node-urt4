const Party = require('./party');

class PartyXmas extends Party {
  getPartyParams(map) {
    const pp = super.getPartyParams(map);
    pp.music = this.$.music.jinglebells;
    return pp;
  }

  putTree() {
    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;

    this.urt4.cmds([
      `sv ent 1020 type 4 0 model 1 0 pos ${X+20} ${Y} ${Z-30} ang 0 0 0 solid -1 0 mins -15 -15 -15 maxs 15 15 40 light 10 10 10 10 link 1`,
    ]);
  }
}

PartyXmas.models = {
  tree: 'models/mapobjects/gr_trees/xmasgold.md3',
  radio: 'models/players/gear/backpack.md3',
};

PartyXmas.music = {
  jinglebells: {file: 'sound/jinglebells.wav', length: 54000, beat: 500},
};

module.exports = PartyXmas;
