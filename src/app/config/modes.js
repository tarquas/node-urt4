const fs = require('fs');
const funMaps = fs.existsSync('./fun-maps.js') ? require('./fun-maps.js') : require('./fun-maps-bundle.js');
const jumpMaps = fs.existsSync('./jump-maps.js') ? require('./jump-maps.js') : require('./jump-maps-bundle.js');
const rules = fs.existsSync('./rules.js') ? require('./rules.js') : require('./rules-bundle.js');

module.exports = {
  defaults: {
    desc: 'unknown mode',

    pre: {
      g_gametype: 0,
      g_matchmode: 0,
      g_followstrict: 0,
      g_friendlyfire: 2,
      g_swaproles: 0,
      nodeurt_cmod_unleash: 0
    },

    post: {
      g_password: '',
      g_gear: '',
      g_maxrounds: 0,
      timelimit: 20,
      fraglimit: 0,
      capturelimit: 0,
      g_noDamage: 0,
      g_noVest: 0,
      g_inactivity: 0
    },

    mod: {
      fastTeam: 0,
      sameResp: 0,
      infSta: 0,
      saveLoadBind: 0,
      posCmds: 0
    },

    mapSrc: [
      //'urbanterror.info',
      '78.47.168.69/maps',
      'fallin-angels.org',
      'b00bs-clan.com/maps',
      'urtctf.com',
      'maps.goldenhelmets.fr',
      'www.dieinarapefire.com',
      'maps.bihanbreizh.fr' // jump maps
    ],

    rules: rules.other
  },

  modes: {

    // TEMPLATES

    fun: {
      inherits: [],
      maps: funMaps
    },

    old: {
      inherits: [],
      mapsAdd: ['ut4_paris_v2', 'ut4_uptown41'],
      mapsDel: ['ut4_paris', 'ut4_uptown']
    },

    public: {
      inherits: [],
      pre: {g_matchmode: 0},

      post: {
        g_password: '',
        g_gear: 'Q',
        g_inactivity: 60
      }
    },

    uz: {
      inherits: [],
      pre: {g_matchmode: 1, g_followstrict: 1},
      post: {g_password: 'powerowns'}
    },

    unleash: {
      inherits: [],
      pre: {nodeurt_cmod_unleash: 1},

      mapsAdd: [
        'ut4_kingpin',
        'ut4_ambush',
        'ut4_harbortown',
        'ut4_sarlat_alpha4'
      ],

      mapsDel: [
        'ut4_tohunga_b8',
        'ut4_orbital_sl',
        'ut4_paris',
        'ut4_riyadh'
      ]
    },

    // GAME MODES

    bomb: {
      enabled: true,
      desc: 'public Bomb game',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 8,
        g_swaproles: 1
      },

      post: {
        timelimit: 10
      },

      mapsAdd: [
        'ut4_prague',
        'ut4_orbital_sl',
        'ut4_beijing_b3',
        'ut4_kingdom',
        'ut4_mandolin',
        'ut4_bohemia',
        'ut4_algiers',
        'ut4_dust2_v2',
        'ut4_cascade',
        'ut4_uptown',
        'ut4_sanc',
        'ut4_facade_b5'
      ]
    },

    'bomb.fun': {
      enabled: true,
      desc: 'public Bomb custom maps',
      maps: funMaps,
      inherits: ['bomb', 'fun']
    },

    'bomb.old': {
      enabled: true,
      desc: 'public Bomb old school',
      inherits: ['bomb', 'old']
    },

    'bomb.uz': {
      enabled: true,
      desc: 'UZ match Team Survivor game',
      inherits: ['bomb', 'uz']
    },

    ctf: {
      enabled: true,
      desc: 'public Capture The Flag game',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 7,
        g_swaproles: 1
      },

      post: {
        timelimit: 10
      },

      rules: rules.ctf,

      mapsAdd: [
        'ut4_turnpike',
        'ut4_tohunga_b8',
        'ut4_abbey',
        'ut4_paris',
        'ut4_orbital_sl',
        'ut4_beijing_b3',
        'ut4_kingpin',
        'ut4_algiers',
        'ut4_uptown',
        'ut4_village_'
      ]
    },

    'ctf.uz': {
      enabled: true,
      desc: 'UZ match Capture The Flag game',
      inherits: ['ctf', 'uz']
    },

    'ctf.fun': {
      enabled: true,
      desc: 'public Capture The Flag custom maps',
      maps: funMaps,
      inherits: ['ctf', 'fun']
    },

    'ctf.old': {
      enabled: true,
      desc: 'public Capture The Flag old school',
      inherits: ['ctf', 'old']
    },

    'ffa': {
      enabled: true,
      desc: 'public Free For All game',
      inherits: ['', 'public'],

      mapsAdd: [
        'ut4_turnpike',
        'ut4_tohunga_b8',
        'ut4_abbey',
        'ut4_paris',
        'ut4_orbital_sl',
        'ut4_beijing_b3',
        'ut4_kingdom',
        'ut4_austria',
        'ut4_algiers',
        'ut4_casa',
        'ut4_uptown',
        'ut4_riyadh',
        'ut4_facade_b5',
        'ut4_prague'
      ]
    },

    'ffa.unleash': {
      enabled: true,
      desc: 'public Free For All unleashed',
      inherits: ['ffa', 'unleash']
    },

    freeze: {
      enabled: true,
      desc: 'public Freeze Tag game',
      inherits: ['ts'],
      pre: {g_gametype: 10}
    },

    jump: {
      enabled: true,
      desc: 'public Jump game',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 9
      },

      post: {
        timelimit: 0,
        g_noDamage: 1,
        g_noVest: 1,
        g_inactivity: 0
      },

      mod: {
        fastTeam: 1,
        sameResp: 1,
        infSta: 1,
        saveLoadBind: 1,
        posCmds: 1
      },

      rules: rules.jump,

      mapsAdd: jumpMaps
    },

    ts: {
      enabled: true,
      desc: 'public Team Survivor game',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 4,
        g_swaproles: 0
      },

      post: {
        timelimit: 20
      },

      mapsAdd: [
        'ut4_turnpike',
        'ut4_tohunga_b8',
        'ut4_abbey',
        'ut4_paris',
        'ut4_orbital_sl',
        'ut4_beijing_b3',
        'ut4_kingdom',
        'ut4_austria',
        'ut4_algiers',
        'ut4_casa',
        'ut4_uptown',
        'ut4_riyadh',
        'ut4_facade_b5',
        'ut4_prague'
      ]
    },

    'ts.fun': {
      enabled: true,
      desc: 'public Team Survivor custom maps',
      maps: funMaps,
      inherits: ['ts', 'fun']
    },

    'ts.old': {
      enabled: true,
      desc: 'public Team Survivor old school',
      inherits: ['ts', 'old']
    },

    'ts.uz': {
      enabled: true,
      desc: 'UZ match Team Survivor game',
      inherits: ['ts', 'uz']
    }
  }
};
