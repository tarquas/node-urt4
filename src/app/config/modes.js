const fs = require('fs');
const funMaps = fs.existsSync(`${__dirname}/fun-maps.js`) ? require('./fun-maps') : require('./fun-maps-bundle');
const jumpMaps = fs.existsSync(`${__dirname}/jump-maps.js`) ? require('./jump-maps') : require('./jump-maps-bundle');
const rules = fs.existsSync(`${__dirname}/rules.js`) ? require('./rules') : require('./rules-bundle');

module.exports = {
  defaults: {
    desc: 'unknown mode',

    pre: {
      g_antiwarp: 1,
      g_gametype: 0,
      g_matchmode: 0,
      g_followstrict: 0,
      g_friendlyfire: 2,
      g_swaproles: 0,
      nodeurt_cmod_unleash: 0
    },

    post: {
      sv_matchStart: 0,
      g_password: '',
      g_gear: '',
      g_maxrounds: 0,
      timelimit: 20,
      fraglimit: 0,
      capturelimit: 0,
      g_noDamage: 0,
      g_noVest: 0,
      g_inactivity: 0,
      sv_autoRecordDemo: 1,
    },

    mod: {
      fastTeam: 0,
      sameResp: 0,
      infSta: 0,
      saveLoadBind: 0,
      posCmds: 0,
      emitLoc: 0
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

    frag: {
      inherits: [],
      pre: {},
      post: {
        bot_minplayers: 0,
      }
    },

    fun: {
      inherits: [],
      maps: funMaps
    },

    old: {
      inherits: [],
      mapsAdd: ['ut4_paris_v2', 'ut4_uptown41'],
      mapsDel: ['ut4_paris', 'ut4_uptown']
    },

    icy: {
      inherits: [],
      pre: {sv_iceEverywhere: 1},
      post: {sv_infiniteStamina: 1, g_enablePrecip: 2}
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
      inherits: ['icy'],
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
      desc: 'BOMB public',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 8,
        g_swaproles: 1
      },

      post: {
        timelimit: 10
      },

      mapsAdd: [
        'ut4_abbey',
        'ut4_prague',
        'ut4_orbital_sl',
        'ut4_beijing_b3',
        'ut4_kingdom',
        'ut4_cache_b6',
        'ut4_mandolin',
        'ut4_bohemia',
        'ut4_algiers',
        'ut4_dust2_v2',
        'ut4_casa',
        'ut4_turnpike',
        'ut4_uptown',
        'ut4_sanc',
        'ut4_facade_b5_fix'
      ]
    },

    'bomb.fun': {
      enabled: true,
      desc: 'BOMB fun',
      maps: funMaps,
      inherits: ['bomb', 'fun'],
      nextmode: 'bomb'
    },

    'bomb.old': {
      enabled: true,
      desc: 'BOMB oldschool',
      inherits: ['bomb', 'old']
    },

    'bomb.uz': {
      enabled: true,
      desc: 'TS match UZ',
      inherits: ['bomb', 'uz']
    },

    ctf: {
      enabled: true,
      desc: 'wave CTF public',
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
        'ut4_paris',
        'ut4_orbital_sl',
        'ut4_abbey',
        'ut4_algiers',
        'ut4_sarlat_alpha4',
        'ut4_beijing_b3',
        'ut4_uptown',
        'ut4_kingpin',
        'ut4_village',
      ]
    },

    'ctf.uz': {
      enabled: true,
      desc: 'wave CTF match UZ',
      inherits: ['ctf', 'uz']
    },

    'ctf.fun': {
      enabled: true,
      desc: 'wave CTF fun',
      maps: funMaps,
      inherits: ['ctf', 'fun'],
      nextmode: 'ctf'
    },

    'ctf.old': {
      enabled: true,
      desc: 'wave CTF oldschool',
      inherits: ['ctf', 'old']
    },

    'ffa': {
      enabled: true,
      desc: 'FFA public',
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
        'ut4_facade_b5_fix',
        'ut4_prague'
      ]
    },

    'ffa.unleash': {
      enabled: true,
      desc: 'FFA unleashed',
      inherits: ['ffa', 'unleash']
    },

    freeze: {
      enabled: true,
      desc: 'FREEZE public',
      inherits: ['ts'],
      pre: {g_gametype: 10},
      post: {g_inactivity: 180}
    },

    jump: {
      enabled: true,
      desc: 'JUMP public',
      inherits: ['', 'public'],

      pre: {
        g_gametype: 9
      },

      post: {
        sv_matchStart: 0,
        timelimit: 0,
        g_noDamage: 1,
        g_noVest: 1,
        g_inactivity: 0,
        bot_minplayers: 0,
      },

      mod: {
        fastTeam: 1,
        sameResp: 1,
        infSta: 1,
        saveLoadBind: 1,
        posCmds: 1,
        emitLoc: 1
      },

      rules: rules.jump,

      mapsAdd: jumpMaps
    },

    ts: {
      enabled: true,
      desc: 'TS public',
      inherits: ['', 'public', 'frag'],

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
        'ut4_prague',
        'ut4_orbital_sl',
        'ut4_abbey',
        'ut4_sanc',
        'ut4_beijing_b3',
        'ut4_kingdom',
        'ut4_austria',
        'ut4_casa',
        'ut4_uptown',
        'ut4_cambridge_b1',
        'ut4_pipeline_b3',
        'ut4_derelict_b3',
      ]
    },

    'ts.fun': {
      enabled: true,
      desc: 'TS fun',
      maps: funMaps,
      inherits: ['ts', 'fun'],
      nextmode: 'ts'
    },

    'ts.old': {
      enabled: true,
      desc: 'TS oldschool',
      inherits: ['ts', 'old']
    },

    'ts.uz': {
      enabled: true,
      desc: 'TS match UZ',
      inherits: ['ts', 'uz']
    },

    'ctf.icy': {
      enabled: true,
      desc: 'wave CTF all icy',
      inherits: ['ctf', 'icy'],
    },

    'ts.icy': {
      enabled: true,
      desc: 'TS all icy',
      inherits: ['ts', 'icy'],
    }
  }
};
