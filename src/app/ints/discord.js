const {Emitter} = require('clasync');
const Discord = require('discord.js');

class DiscordBot extends Emitter {
  async init(deps) {
    if (!this.token) return;
    this.client = new Discord.Client();
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('message', this.onMessage.bind(this));
    this.client.login(this.token);
  }

  async onReady() {
    console.log(`Discord: logged in as ${this.client.user.tag}!`);
  }

  async getServerInfo(urt4) {
    const info = await urt4.$info.getServerInfo();
    //urt4.admin.$qvm.emit('timelimit', {});
    const msgs = await this.viewServerInfo(info);
    return msgs;
  }

  async viewServerInfo(info) {
    const {
      playersByTeam, playerView, ratingKeys, ratingSort, ipAddress, port, name,
      nextmode, mode, map, nextmap, max, maxgame, modeDesc,
      gameObj, Players, Scores, GameType, gametype
    } = info;

    const result = [];

    const viewPlayer = (p, start, end, sep) => {
      let s = `${start} ${p.ID.padStart(2)} | ${p.NAME.padEnd(playerView.nameLength)} | ` +
        `${p.auth.padEnd(playerView.authLength)}`;

      for (const rating of ratingKeys) {
        s += ` | ${p[rating].padStart(rating.length)}`;
      }

      s += ` ${end}`;
      return s;
    };

    const playerHeader = [
      {ID: 'ID', NAME: 'NAME', auth: 'AUTH'},
      //{ID: '__', NAME: ''.padEnd(playerView.nameLength, '_'), auth: ''.padEnd(playerView.authLength, '_')}
    ];

    for (const rating of ratingKeys) {
      playerHeader[0][rating] = rating;
      //playerHeader[1][rating] = ''.padEnd(rating.length, '_');
    }

    const embed = {
      color: 0x0099ff,
      title: `${map} - ${mode.toUpperCase()}`,
      url: `https://www.urbanterror.info/servers/${ipAddress}:${port}/`,

      author: {
        name: `${name} -- ${Players} / ${maxgame} / ${max}`,
        icon_url: 'http://pwnz.pro/img/favicon.png',
        url: `https://www.urbanterror.info/servers/${ipAddress}:${port}/`,
      },

      description: modeDesc,

      image: {
        url: `https://www.urbanterror.info/files/static/images/levels/wide/${map}.jpg`,
      },

      thumbnail: {
        url: this.$.gamemodeIcons[gametype] || this.$.gamemodeIcons.default,
      },

      fields: Object.entries(gameObj).map(([name, value]) => ({name, value, inline: true})),

      timestamp: new Date(),

      footer: {
        text: 'PM *help stat* to bot to get definitions for terms below',
        icon_url: 'http://pwnz.pro/img/bulb-icon.png',
      },
    };

    result.push({embed});

    if (Scores) {
      const [, redScore, blueScore] = Scores.match(this.$.rxPlayersOutScores) || [, 0, 0];

      const RED = playersByTeam.RED || [];
      const BLUE = playersByTeam.BLUE || [];
      const SPECTATOR = playersByTeam.SPECTATOR || [];

      result.push([
        '```css',
        `[    -- ${RED.length} Red -- ( ${redScore} )    ]`,
        ...RED.length ? playerHeader.map(p => viewPlayer(p, '[', ']')) : [],
        ...RED.map(p => viewPlayer(p, '[', ']')),
        '```'
      ].join('\n'));

      result.push([
        '```ini',
        `[    -- ${BLUE.length} Blue -- ( ${blueScore} )    ]`,
        ...BLUE.length ? playerHeader.map(p => viewPlayer(p, '[', ']')) : [],
        ...BLUE.map(p => viewPlayer(p, '[', ']')),
        '```'
      ].join('\n'));

      result.push([
        '```',
        `[    -- ${SPECTATOR.length} Spectators --    ]`,
        ...SPECTATOR.length ? playerHeader.map(p => viewPlayer(p, '[', ']')) : [],
        ...SPECTATOR.map(p => viewPlayer(p, '[', ']')),
        '```'           
      ].join('\n'));
    } else {
      const FREE = playersByTeam.FREE || [];
      const SPECTATOR = playersByTeam.SPECTATOR || [];

      result.push([
        '```css',
        `"    -- ${FREE.length} Players --    "`,
        ...FREE.length ? playerHeader.map(p => viewPlayer(p, '"', '"')) : [],
        ...FREE.map(p => viewPlayer(p, '"', '"')),
        '```'
      ].join('\n'));

      result.push([
        '```',
        `"    -- ${SPECTATOR.length} Spectators --    "`,
        ...SPECTATOR.length ? playerHeader.map(p => viewPlayer(p, '"', '"')) : [],
        ...SPECTATOR.map(p => viewPlayer(p, '"', '"')),
        '```'
      ].join('\n'));
    }

    return result;
  }

  async getServersInfo(mode) {
    const reply = [];

    for (const urt4 of Object.values(this.$$.urt4s)) {
      if (mode && !mode(urt4)) continue;
      const getServerInfo = this.$.bindOnce(urt4, this, this.getServerInfo, urt4);
      const result = await this.$.timeThrottle(true, this.$.serverInfoThrottle, getServerInfo);
      reply.push(...result);
    }

    return reply;
  }

  async onMessage(msg) {
    if (msg.author.bot) return;
    if (msg.channel.type !== 'dm') return;

    //console.log(msg);

    const all = msg.content.toLowerCase();
    const reply = [];

    try {
      switch (all) {
        case 'list': case 'servers': reply.push(...await this.getServersInfo()); break;
        case 'war': case 'gun': reply.push(...await this.getServersInfo(urt4 => urt4.admin.$mod.gametype != 9)); break;
        case 'jump': reply.push(...await this.getServersInfo(urt4 => urt4.admin.$mod.gametype == 9)); break;

        case 'help': reply.push(
          `hello ${msg.author.username}!\n` +
          `i'm still on WIP, but something is ready for u now! check this:\n\n` +
          `**list** or **servers** - view information about our online servers\n` +
          `**war** or **gun** - view information about our online shooting servers\n` +
          `**jump** - view information about our online jumping servers\n` +
          `**help stat** - view information about terms used in player stats\n`
        ); break;

        case 'help stat': reply.push(
          `**General terms:**`,
          `- *KILLS* - number of frags: enemies killed, minus allies killed, minus suicides, plus game mode specific frags\n` +
          `- *DEATHS* - number of times died by any means\n` +
          `- *ASSISTS* - number of enemies damaged to more than 50 HP, who finally died by any means\n` +
          `**CTF terms:**\n` +
          `- *CAP* - number of flags CAPtured; brings 5 frags plus 10 frags to team\n` +
          `- *RET* - number of flags RETurned; brings 1 frag\n` +
          `- *KFC* - number of Killed enemies, which were Flag Carriers; brings 1 frag\n` +
          `- *STC* - STopped Captures - number of killed flag enemy carriers near enemy flag spot\n` +
          `- *PRF* - PRotections of own Flag - number of enemies killed near own flag\n` +
          `**BOMB terms**\n` +
          `- *PLT* - number of bombs PLanTed\n` +
          `- *SBM* - Successful BoMbings - number of planted bombs, which exploded\n` +
          `- *PKB* - Players, Killed by Bomb\n` +
          `- *DEF* - number of bombs DEFused\n` +
          `- *KBD* - Killed Bomb enemy Defusers\n` +
          `- *KBC* - Killed Bomb enemy Carriers\n` +
          `- *PKBC* - Prevented Killing Bomb ally Carriers`
        ); break;

        case 'hi': case 'hello': case 'hola':
          reply.push(`hello ${msg.author.username}! use 'help' to find out how can i help you`); break;
        default:
          reply.push(`sorry i don't know what means ${msg.content}. use 'help' to find out what i know`); break;
      }

      for (const item of reply) {
        await msg.reply(item);
      }
    } catch (err) {
      await msg.reply(`!!! internal error. plz inform developers !!!`);
      this.$.throw(err, 'DISCORD BOT');
    }

  }

  async cmd() {
    const as = {
      virtual: true,
      client: -2,
      level: this.admin.$.levels.console, //TODO:
      allowedCmds: this.admin.modCmds
    };

    const result = await this.admin.execCmd(as, cmd, {blames: []});

    if (result !== this.admin.$.cmdErrors.missing) {
      return this.$players.clCmdResult({cmd, client: -2, result});
    }
  }
}

DiscordBot.rxPlayersOutScores = /^R:(\d+) B:(\d+)$/;

DiscordBot.gamemodeIcons = {
  default: 'http://pwnz.pro/img/urt-big.png',
  4: 'http://pwnz.pro/img/ts.png?1',
  7: 'http://pwnz.pro/img/ctf.png',
  9: 'http://pwnz.pro/img/jump.png?1'
};

DiscordBot.serverInfoThrottle = 10000;

module.exports = DiscordBot;
