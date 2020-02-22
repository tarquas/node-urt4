const Cmd = require('./cmd');

class Party extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$pos', '$inv', '$players')
    });

    this.scene = 0;
    this.partyOn = 0;
    this.musicEnds = 0;

    this.$players.on('user', this.soundBug.bind(this));
    this.$qvm.on('begin', this.invitePlayer.bind(this));
    this.$qvm.on('spawn', this.invitePlayer.bind(this));

    this.$qvm.on('warmup', this.beginScene.bind(this, true));

    this.$qvm.on('timelimit', this.beginScene.bind(this, false));
    this.$qvm.on('shutdown', this.onSilence.bind(this));

    this.$qvm.on('world', this.endScene.bind(this));
    this.$qvm.on('game', this.endScene.bind(this));
    this.$qvm.on('round', this.onRound.bind(this));

    this.partyDanceBound = this.partyDance.bind(this);
  }

  async soundBug({client}) {
    await this.$.delay(100);
    await this.invitePlayer({client});
  }

  async invitePlayer({client}) {
    if (this.partyOn) await this.invitePlayers([client]);
  }

  newScene(partyOn) {
    this.partyOn = partyOn || false;
    return ++this.scene;
  }

  defResources() {
    const pp = this.partyParams;

    const res = {
      [288 + 255]: pp.music.file,
      [32 + 1]: this.$.models.tree,
      [32 + 2]: this.$.models.radio,      
    };

    return res;
  }

  sendResources(c) {
    const res = this.resources;
    this.urt4.cmds(Object.entries(res).map(([k, v]) => `sv svcmd ${c} cs ${k} "${v}"`));
  }

  setResources() {
    const res = this.resources;
    this.urt4.cmds(Object.entries(res).map(([k, v]) => `sv cfg ${k} ${v}`));
  }

  async invitePlayers(clients) {
    if (!clients.length) return;

    await this.$.delay(100);

    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;
    const d = this.$.dancers;
    const [SX, SY, SZ] = d.specPos;

    await this.$.all(clients.map(c => this.sendResources(c)));

    this.urt4.cmds(this.$.flatten(clients.map(c => [
      `sv ps ${c} pos ${X+SX} ${Y+SY} ${Z+SZ} ang ${d.specAng.join(' ')} weapons${''.padEnd(32, ' 0')} items ${d.flags?(c&1)+1:0}${''.padEnd(30, ' 0')}`,
    ])));
 
    (async () => {
      await this.$.delay(200);

      if (this.interactive) {
        this.urt4.cmds(this.$.flatten(clients.map(c => [
          ...''.padEnd(10).split('').map(() => `sv svcmd ${c} print " "`),
          `sv svcmd ${c} print "     ${this.$.text.invite}"`,
          `sv svcmd ${c} cp "${this.$.text.welcome}"`,
          `sv svcmd ${c} cs 1001 " ${this.$.text.where}"`
        ])));
   
        await this.$.delay(3000);

        this.urt4.cmds(this.$.flatten(clients.map(c => [
          `sv svcmd ${c} cp "${this.$.text.welcome}"`,
          `sv svcmd ${c} cs 1001 " ${this.$.text.where}"`
        ])));

        await this.$.delay(3000);

        this.urt4.cmds(this.$.flatten(clients.map(c => [
          `sv svcmd ${c} cs 1001 ""`
        ])));
      } else {
        this.urt4.cmds(this.$.flatten(clients.map(c => [
          `sv svcmd ${c} print "     ${this.$.text.thanks}"`,
          `sv svcmd ${c} cs 1001 " ${this.$.text.gg}"`
        ])));

        await this.$.delay(3000);

        this.urt4.cmds(this.$.flatten(clients.map(c => [
          `sv svcmd ${c} print "     ${this.$.text.thanks}"`,
          `sv svcmd ${c} cs 1001 " ${this.$.text.gg}"`
        ])));
      }
    })()
  }

  getPartyParams(map) {
    const p = this.$.mapParams[map];
    if (!p) return this.partyParams = null;
    const [X, Y, Z] = p.pos;
    const pp = {base: [X, Y, Z], music: this.$.music[p.music]};
    return pp;
  }

  putDancers() {
    const pp = this.partyParams;
    const b = pp.base;

    const d = this.$.dancers;

    this.urt4.cmds(this.$.flatten(d.ang.map((ang, i) => {
      const id = d.ent + i;
      const pos = d.pos[i].map((p, j) => p + b[j]).join(' ');

      const cmds = [
        `sv ent ${id} type ${d.type.join(' ')} solid ${d.solid.join(' ')} ` +
        `mins ${d.mins.join(' ')} maxs ${d.maxs.join(' ')} relate ${d.ent + i} 1022 0 0 1023 ` +
        `pos ${pos} ang ${ang.join(' ')} ` +
        `model ${d.model[i].join(' ')} player ${d.player[i].join(' ')} 21 21 link 1`
      ];

      /*if (id < 32) cmds.push(
        `sv ps ${id} pos ${pos} ang ${ang.join(' ')} player 0 1 0 4 ${id}`
      );*/

      if (d.lightEnt) cmds.push(
        `sv ent ${d.lightEnt + i} type 12 0 pos ${pos} ang ${ang.join(' ')} link 1`
      );

      return cmds;
    })));

    /*let e = this.$.dancers.ent;

    this.urt4.cmds([
      `${e++} model 1 2 pos ${X+107} ${Y-50} ${Z} ang 0 135 0`,
      `${e++} model 2 0 pos ${X-93} ${Y-50} ${Z} ang 0 45 0`,
      `${e++} model 1 1 pos ${X-143} ${Y+150} ${Z} ang 0 -45 0`,
      `${e++} model 2 3 pos ${X+107} ${Y+100} ${Z} ang 0 -135 0`,
      `${e++} model 1 0 pos ${X-30} ${Y+200} ${Z} ang 32 -112 0`,
    ].map(s => `sv ent ${s} type 1 0 solid -1 0 mins -15 -15 -24 maxs 15 15 45 link 1`));

    this.urt4.cmds([
      `1000 model 1 2 pos ${X+107} ${Y-50} ${Z} ang 0 135 0`,
      `1001 model 2 0 pos ${X-93} ${Y-50} ${Z} ang 0 45 0`,
      `1002 model 1 1 pos ${X-143} ${Y+150} ${Z} ang 0 -45 0`,
      `1003 model 2 3 pos ${X+107} ${Y+100} ${Z} ang 0 -135 0`,
      `1004 model 1 0 pos ${X-30} ${Y+200} ${Z} ang 32 -112 0`,
    ].map(s => `sv ent ${s} type 5 0 player 2562 14 0 0 solid -1 0 mins -15 -15 -24 maxs 15 15 45 link 1`));*/

    /*this.urt4.cmds([
      `sv ent 24 model 1 0 pos ${X-30} ${Y+200} ${Z} ang 32 -112 0 type 1 0 player 1 7 0 0 solid -1 0 mins -15 -15 -24 maxs 15 15 45 link 1`,
      `sv cfg ${544+24} n\\Vasya\\t\\2\\r\\2\\tl\\0\\f0\\cigar\\f1\\goggles\\f2\\touqrd\\a0\\255\\a1\\0\\a2\\255`,
    ]);*/
  }

  putTree() {
    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;

    this.urt4.cmds([
      `sv ent 900 type 4 0 model 1 0 pos ${X-18} ${Y+8} ${Z} ang -60 10 40 solid -1 0 mins -15 -15 -15 maxs 15 15 40 link 1`,
      `sv ent 901 type 4 0 model 1 0 pos ${X+18} ${Y-8} ${Z} ang -60 -170 40 solid -1 0 mins -15 -15 -15 maxs 15 15 40 link 1`,
      `sv ent 902 type 4 0 model 1 0 pos ${X-8} ${Y-18} ${Z} ang -60 100 40 solid -1 0 mins -15 -15 -15 maxs 15 15 40 link 1`,
      `sv ent 903 type 4 0 model 1 0 pos ${X+8} ${Y+18} ${Z} ang -60 -80 40 solid -1 0 mins -15 -15 -15 maxs 15 15 40 link 1`,
    ]);
  }

  putRadio() {
    const pp = this.partyParams;
    const [X, Y, Z] = pp.base;

    this.urt4.cmds([
      `sv ent 1018 type 4 0 model 2 0 pos ${X} ${Y+25} ${Z-20} ang 0 -90 0 solid -1 0 mins -15 -15 -15 maxs 15 15 10 link 1`,
    ]);
  }

  putMore() {
  }

  async beginScene(loop) {
    await this.$.delay(100);

    if (this.sceneDone) return;
    this.sceneDone = 1;
    this.interactive = loop;

    const map = await this.urt4.rpc('com getcvar mapname');
    const pp = this.getPartyParams(map);
    this.partyParams = pp;
    if (!pp) return;

    const scene = this.newScene(true);
    this.resources = await this.defResources();

    const [X, Y, Z] = pp.base;

    //this.urt4.cmd('sv ent 1021 type 5 0 model 2 0 pos 1348 -929 48 ang 0 90 0 player 2562 14 0 0 link 1'); // in room

    await this.putWeather();
    await this.setResources();

    await this.putDancers();
    await this.putTree();
    await this.putRadio();
    await this.putMore();

    //`sv ent 1017 type 0 0 event 0 0 0 0 player 0 12 0 0 pos ${X+20} ${Y-48} ${Z+500} link 1`,

    if (!this.debug || this.debugSnd) (async () => {
      const now = +new Date();
      const wait = this.musicEnds - now;

      if (wait > 0) await this.$.delay(wait);
      if (this.scene !== scene) return;
      if (!loop) this.musicEnds = now + pp.music.length;

      this.urt4.cmds([
        `sv ent 1019 type ${loop ? 12 : 79} 0 sound ${loop ? 255 : 0} event 32 0 0 255 pos ${X+20} ${Y+20} ${Z+10} link 1`,
      ]);

      await this.$.delay(100);
      if (!loop) this.urt4.cmd(`sv ent 1019 type 0 0 link 0`);
    })();

    (async () => {
      await this.$.delay(1000);
      await this.invitePlayers(Object.keys(this.$players.clients));
    })();

    this.anim = 0;
    this.partyDanceBound(scene);
  }

  async partyDance(scene) {
    if (this[this.$.instance].final) return;
    if (this.scene !== scene) return;
    const pp = this.partyParams;

    const from = 21, to = 46, len = to - from;
    const L = 3;

    const a = (Math.random() * len + from) | 0;
    const b = (Math.random() * len + from) | 0;

    const d = this.$.dancers;
    const n = d.n;

    for (let i = 0; i < n; i++) {
      // max 80 anims for both legs and torso

      const R = Math.random() * L | 0;
      const G = Math.random() * L | 0;
      const B = Math.random() * L | 0;

      this.urt4.cmds([
        `sv ent ${d.ent + i} player ${d.player[i].join(' ')} ${a} ${b} light ${R} ${G} ${B} ${d.lightAmp}`,
      ]);

      if (d.lightEnt) this.urt4.cmds([
        `sv ent ${d.lightEnt + i} light ${R} ${G} ${B} ${d.lightAmp}`,
      ]);
    }

    /*if (this.anim % 4 === 0) (async () => {
      this.urt4.cmd(`sv ent 1017 event 0 0 55 0`);
      await this.$.delay(100);
      this.urt4.cmd(`sv ent 1017 event 0 0 0 0`);
    })();*/

    if (++this.anim >= 64) this.anim = 0;
    setTimeout(this.partyDanceBound, pp.music.beat, scene);
  }

  putWeather() {
    this.urt4.cmd(`com cvar 1 g_enablePrecip 2`);
  }

  removeWeather() {
    this.urt4.cmd(`com cvar 1 g_enablePrecip 0`);
  }

  async endScene() {
    this.sceneDone = 0;
    this.newScene();
    await this.removeWeather();
  }

  async onSilence() {
    this.musicEnds = 0;
  }

  async onRound() {
    const info = await this.urt4.$info.getServerInfo();
    if (info.WarmupPhase === 'YES') await this.beginScene(true);
    else await this.endScene();
  }
}

Party.models = {
  tree: 'models/trees/ivy/ivy2.md3',
  radio: 'models/players/gear/backpack.md3',
};

Party.music = {
  wuTang: {file: 'sound/ghostcity/shameonanigga.wav', length: 36000, beat: 300},
  jazz: {file: 'sound/uptown/jazz.wav', length: 60000, beat: 400},
  bibounde: {file: 'sound/ut4_paris/bibounde.wav', length: 19000, beat: 444},
  quatrains: {file: 'sound/ut4_suburbs/quatrainsloop2a.wav', length: 29000, beat: 400},
  mykonos: {file: 'sound/ut4_mykonos/ut4_mykonos_music.wav', length: 13000, beat: 200},
  hiphop: {file: 'sound/kingpin/ambiencehiphop1.wav', length: 10000, beat: 312},
  main: {file: 'music/mainmenu.wav', length: 28000, beat: 400},
  herring: {file: 'sound/codey2/herring_theme.wav', length: 22000, beat: 250},
  accordeon: {file: 'sound/ut4_paris/accordeon.wav', length: 15000, beat: 250},
  ml1: {file: 'sound/null_twist/ml1.wav', length: 22000, beat: 250},
  kingdom: {file: 'sound/kingdom/kingdom.wav', length: 80000, beat: 250},
  flute1: {file: 'sound/pr_music/flute1.wav', length: 30000, beat: 250},
  casa: {file: 'sound/casa/bbq_casa_digital.wav', length: 17000, beat: 250},
  eagle: {file: 'sound/eagle/musac.wav', length: 15000, beat: 400},
};

Party.mapParams = {
  ut4_turnpike: {pos: [650, -452, 28], music: 'wuTang'},
  ut4_tohunga_b8: {pos: [-1290, 1421, 74], music: 'main'},
  ut4_abbey: {pos: [-1794, 1063, -7], music: 'jazz'},
  ut4_paris: {pos: [-880, 883, 32], music: 'bibounde'},
  ut4_orbital_sl: {pos: [-1284, 774, 28], music: 'herring'},
  ut4_beijing_b3: {pos: [228, 1992, 20], music: 'hiphop'},
  ut4_kingpin: {pos: [95, -1651, -82], music: 'hiphop'},
  ut4_algiers: {pos: [1658, 2160, 136], music: 'mykonos'},
  ut4_uptown: {pos: [1335, -1553, 432], music: 'jazz'},
  ut4_village: {pos: [1651, 1241, 36], music: 'herring'},
};

Party.text = {
  invite: '^5You^3 have been invited to join...',
  welcome: '^5Welcome ^3to the ^1party^6!',
  where: '^7@ ^3pwnz^5.pro ^4community^6!',
  thanks: '^5Thank you^3 for sharing this ^1party^3 with us ^1:)',
  gg: '^5gg^6!',
};

Party.dancers = {
  ent: 1000,
  n: 5,
  specPos: [-101, 248, 49],
  specAng: [24, -68, 0],
  type: [5, 0],
  solid: [-1, 0],
  mins: [-15, -15, -24],
  maxs: [15, 15, 45],
  pos: [[107, -50, 0], [-93, -50, 0], [-143, 150, 0], [107, 100, 0], [-30, 200, 0]],
  ang: [[0, 135, 0], [0, 45, 0], [0, -45, 0], [0, -135, 0], [32, -112, 0]],
  model: [[1, 2], [2, 0], [1, 1], [2, 3], [1, 0]],
  player: [[0, 12], [0, 12], [0, 12], [0, 12], [0, 12]],
  lightAmp: 70
};

module.exports = Party;
