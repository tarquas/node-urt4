const {$, Emitter} = require('clasync');
const Discord = require('discord.js');

class DiscordBot extends Emitter {
  async init(deps) {
    if (!this.token) return;

    await deps({
      $db: this.$$.$db
    });

    this.client = new Discord.Client();
    this.client.on('error', this.onError.bind(this));
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('message', this.onMessage.bind(this));
    this.client.login(this.token);
  }

  async onError(err) {
    this.throw(err, 'DISCORD');
  }

  async onReady() {
    this.$.log(`Discord: logged in as ${this.client.user.tag}!`);
  }

  async getServerInfo(urt4) {
    const info = await urt4.$info.getServerInfo();
    //urt4.admin.$qvm.emit('timelimit', {});
    const msgs = await this.viewServerInfo(info);
    return msgs;
  }

  static escape(text) {
    const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1'); // unescape any "backslashed" character
    const escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1'); // escape *, _, `, ~, \ 
    return escaped;
  }

  demoLink$(p) {
    if (!p.demo) return null;
    return `[${p.AUTH === '---' ? this.$.escape(p.NAME) : ' : \`' + this.$.escape(p.auth) + '\`'}](${this.$$.apiUrl}${p.demo})`;
  }

  static rxDcDemoDateName = /\/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\/([^\/]+)$/;
  static dateWeekOpts = {weekday: 'short'};

  static dateAnyOpts = {
    year: 'numeric', month: 'short', day: 'numeric',
    hour12: false, hour: 'numeric', minute: '2-digit',
  };

  dcDemoLink(urt4, file) {
    const demo = urt4.admin.$players.getDemoLink(file);
    const [, y, m, d, h, i, s, name] = demo.match(this.$.rxDcDemoDateName);
    const dt = new Date(y, m-1, d, h, i, s);
    const now = new Date();
    const diff = now - dt;
    const tm = `${h}:${i}`;

    let ds;
    if (diff < 18*3600000) ds = `${tm}`;
    else if (diff < 7*24*3600000) ds = `${dt.toLocaleString('en', {weekday: 'short'})} ${tm}`;
    else ds = dt.toLocaleString('en', this.$.dateAnyOpts);

    return `[${this.$.escape(name)} (${this.$.escape(ds)})](${this.$$.apiUrl}${demo})`;
  }

  embedMultiFields(title, arr) {
    let t = title;
    const res = [];
    const s = [];
    let l = 0;

    for (const item of arr) {
      s.push(item);
      l += item.length;

      if (l > 1024) {
        const L = s.length - 1;
        const S = s.splice(0, L);
        res.push({name: t, value: S.join('; '), inline: false});
        t = '...';
        l = s[0].length;
      }
    }

    if (s.length) res.push({name: t, value: s.join('; '), inline: false});
    return res;
  }

  async viewServerInfo(info) {
    const {
      playersByTeam, playerView, ratingKeys, ratingSort, ipAddress, port, name,
      nextmode, mode, map, nextmap, max, maxgame, modeDesc,
      gameObj, Players, Scores, GameType, gametype, dcDemos, urt4,
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

    const demos = this.embedMultiFields('DEMOS of Connected players', info.playersObj.map(this.demoLink).filter($.echo));

    const dcDemoLink = this.dcDemoLink.bind(this, urt4);
    const dcdemos = this.embedMultiFields('DEMOS of Disconnected players', dcDemos.map(dcDemoLink));

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

      fields: [
        ...Object.entries(gameObj).map(([name, value]) => ({name, value, inline: true})),
        ...demos,
        ...dcdemos,
      ],

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

    const urt4 = this.$.firstValue(this.$$.urt4s);

    if (!urt4) {
      await msg.reply('no URT servers running! plz inform our @Admin');
      return;
    }

    const {admin} = urt4;
    const {$users} = this.$db;
    const discordUserId = msg.author.id;

    const caller = await $users.model.findOne(
      {discordUserId: msg.author.id},
      {auth: 1, 'settings.level': 1}
    ).lean().exec();

    const role = this.$.getDef(caller, 'settings', 'level', 0);

    const all = msg.content;
    const [cmd, ...args] = urt4.admin.parseArgs(all);
    const reply = [];

    const apply = async () => {
      if (!reply.length) return false;

      for (const item of reply) {
        await msg.reply(item);
      }

      return true;
    };

    if (role >= admin.$.levels.sup) {
      switch (cmd.toLowerCase()) {
        case 'demo': {
          const [mask] = args;
          if (!mask) { reply.push('usage: **demo** <mask>|*'); break; }
          reply.push('WIP');
        } break;

        case 'restart': {
          const [type] = args;
          if (!type) { reply.push('usage: **restart** war|gun|frag|jump'); break; }
          const servers = this.$$.getServersByType(type.toLowerCase());
          if (!servers.length) { reply.push('No servers of this type found'); break; }
          for (const svr of servers) svr.cmd('com in quit');
          reply.push('Servers have been restarted');
        } break;
      }

      if (await apply()) return;
    }

    try {
      switch (cmd.toLowerCase()) {
        case 'auth': {
          const [auth, pwd] = args;

          if (!auth || !pwd) {
            reply.push(...[
              'usage: **auth** <urt-auth> <password>',
              'if your password is not set, plz set it in-game using same command'
            ]);

            break;
          }

          const success = await $users.model.findOneAndUpdate(
            {auth, pwd},
            {$set: {discordUserId}},
            {select: {pwdOnce: 1}}
          ).lean().exec();

          if (success) {
            if (success.pwdOnce) await $users.model.updateOne({auth, pwd}, {$unset: {pwd: 1}});
            reply.push('You have successfully linked your discord account!');
          } else {
            reply.push('Invalid credentials!');
          };
        } break;

        case 'demo': {
          const [mask] = args;
          if (!mask) { reply.push('usage: **demo** <mask|*>'); break; }
          reply.push('**Your demos**');
          reply.push('*WIP*');
        } break;

        case 'list': case 'servers': reply.push(...await this.getServersInfo()); break;
        case 'war': case 'gun': case 'frag': reply.push(...await this.getServersInfo(urt4 => urt4.admin.$mod.gametype != 9)); break;
        case 'jump': reply.push(...await this.getServersInfo(urt4 => urt4.admin.$mod.gametype == 9)); break;

        case 'help': {
          const [topic] = args;

          if (topic === 'stat') {
            reply.push(
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
            );

            break;
          }

          const levelName = urt4.noColor(admin.$.levelNames[admin.$.levelIds[role]]);

          reply.push(
            `Hello **${msg.author.username}**! You're ${levelName} **${caller ? caller.auth : ' '}**\n` +
            `i'm still on WIP, but something is ready for u now! check this:\n\n` +
            `**list** or **servers** - view information about our online servers\n` +
            `**war** or **gun** or **frag** - view information about our online shooting servers\n` +
            `**jump** - view information about our online jumping servers\n` +
            `**demo** - get your demo\n` +
            `**help stat** - view information about terms used in player stats\n`
          );

          if (role >= admin.$.levels.sup) {
            reply.push(
              `**Admin commands**:\n` +
              `**demo** - get a demo\n` +
              `**restart <type>** - restart servers based on type: **war** (**gun**, **frag**) or **jump**\n`
            );
          }
        } break;

        case 'hi': case 'hello': case 'hola':
          reply.push(`hello ${msg.author.username}! use 'help' to find out how can i help you`); break;
        default:
          reply.push(`sorry i don't know what means ${msg.content}. use 'help' to find out what i know`); break;
      }

      if (await apply()) return;
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
