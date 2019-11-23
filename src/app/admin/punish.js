const Cmd = require('./cmd');

class Punish extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$players', '$votes')
    });

    this.$players.on('user', this.onUser.bind(this));
    this.$players.on('info', this.onInfo.bind(this));
    this.urt4.sv.on('clcmd', this.onClCmd.bind(this));
  }

  async onUser({client}) {
    const player = this.$players.clients[client];
    if (!player) return;
    const mute = this.$.get(player, 'punish', 'mute');

    if (mute) {
      const now = +new Date();
      const msec = mute.until - now;
      if (msec >= 1000) this.urt4.cmd(`com in mute ${player.client} ${parseInt(msec / 1000)}`);
    }
  }

  async onInfo({client}) {
    const player = this.$players.clients[client];
    if (!player) return;
    const name = this.$.get(player, 'punish', 'name');

    if (name && name !== this.$.get(player, 'info', 'name')) {
      // TODO: makeup on stage -1
      this.urt4.cmd(`sv clvar ${player.client} name ${name}`);
    }
  }

  async spamMute(p) {
    const now = +new Date();
    const msec = this.$.msecSpamMute;

    const mute = {
      since: now,
      until: now + msec,
      by: 'spamBuster', byAuth: ''
    };

    await this.$players.set(p, {'punish.mute': mute});

    this.urt4.cmd(`com in mute ${p.client} ${parseInt(msec / 1000)}`);

    this.$players.chat(null, `${this.$players.name(p)} ^3has been muted for ^5${
      this.urt4.showTimeSpan(msec)
    } ^3for ^2spamming`);
  }

  async onClCmd({client, cmd}) {
    const player = this.$players.clients[client];
    if (!player || player.dropped) return 1;
    if (!this.$.rxSpamMuteCmd.test(cmd)) return;

    const spamScore = 0 | this.$.get(player, 'punish', 'spam', 'score');
    const spamLast = this.$.get(player, 'punish', 'spam', 'last');
    const now = +new Date();

    if (spamLast && now - spamLast < this.$.msecSpamMuteGap) {
      if (spamScore === this.$.nSpamMuteScore) await this.spamMute(player);
      this.$.set(player, 'punish', 'spam', 'score', spamScore + 1);
    } else if (spamScore) {
      this.$.set(player, 'punish', 'spam', 'score', 0);
    }

    this.$.set(player, 'punish', 'spam', 'last', now);
  }

  // CMD

  async ['MOD+ ban <player> [<time|"permanent"> <reason>]: Bans a player / checks a ban'](
    {as, blames, args: [player, time, ...reasons]}
  ) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as, {all: true});
    if (p.level >= as.level) return this.admin.$.cmdErrors.access;

    const now = +new Date();
    const cur = this.$.get(p, 'punish', 'ban');
    const lvl = this.admin.$.levelNames[as.level];
    const lvlMsec = this.$.levelMsecLimits[lvl];

    if (!time) {
      if (!cur) return `${this.$players.name(p)} ^3is ^2not^3 banned`;

      return `${this.$players.name(p)} ^3is banned for ^5${
        this.urt4.showTimeSpan(msec)
      }^3. Reason: ^2${reason}`;
    }

    if (cur) {
      if (cur.sealed) {
        return `^1Error ^3Ban for ${
          this.$players.name(p)
        }^3 is sealed by ^1server administrator^3: ${cur.sealed}`;
      }

      const curMsec = cur.until - now;

      if (as.level < this.admin.$.levels.admin && cur && (cur.permanent || curMsec > lvlMsec)) {
        return `^1Error ^3This player is already banned for longer period than ^2${
          this.urt4.showTimeSpan(lvlMsec)
        }^3. You may not reban it.`;
      }
    }

    const reason = reasons.join(' ');
    if (!reason) return `^1Error ^3You must specify a reason for this ban`;
    let ban;

    if (time.toLowerCase() === 'permanent') {
      if (as.level < this.admin.$.levels.admin) return this.admin.$.cmdErrors.access;

      ban = {
        since: now,
        permanent: true,
        by: as.dbId, byAuth: as.auth,
        reason
      };

      await this.$players.set(p, {'punish.ban': ban});
      this.$players.chat(null, `${this.$players.name(p)} ^3has been banned ^5permanently^3. Reason: ^2${reason}`);
    } else {
      const msec = this.urt4.getTimeSpan(time);

      if (msec > lvlMsec) return `^1Error ^3Maximum ban period you may set is ^2${this.urt4.showTimeSpan(lvlMsec)}`;

      if (as.level < this.admin.$.levels.admin && cur && (cur.permanent || cur.until > lvlMsec)) {
        return `^1Error ^3Maximum ban period from which you may unban is ^2${
          this.urt4.showTimeSpan(lvlMsec)
        }`;
      }

      ban = {
        since: now,
        until: now + msec,
        by: as.dbId, byAuth: as.auth,
        reason
      };

      await this.$players.set(p, {'punish.ban': ban});

      this.$players.chat(null, `${this.$players.name(p)} ^3has been banned for ^5${
        this.urt4.showTimeSpan(msec)
      }^3. Reason: ^2${reason}`);
    }

    blames.push(null);

    if (!p.dropped) {
      p.banned = ban;
      this.$players.kick(p, this.$players.banReason(ban));
    }
  }

  async ['MOD+ unban <player>: Unbans a player']({as, blames, args: [player]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as, {all: true});
    if (p.level >= as.level) return this.admin.$.cmdErrors.access;

    const now = +new Date();
    const cur = this.$.get(p, 'punish', 'ban');

    if (cur) {
      if (cur.sealed) {
        return `^1Error ^3Ban for ${
          this.$players.name(p)
        }^3 is sealed by ^1server administrator^3: ${cur.sealed}`;
      }

      const lvl = this.admin.$.levelNames[as.level];
      const lvlMsec = this.$.levelMsecLimits[lvl];
      const curMsec = cur.until - now;

      if (as.level < this.admin.$.levels.admin && cur && (cur.permanent || curMsec > lvlMsec)) {
        return `^1Error ^3Maximum ban period from which you may unban is ^2${
          this.urt4.showTimeSpan(lvlMsec)
        }`;
      }
    }

    await this.$players.unset(p, {'punish.ban': 1});
    this.$players.chat(null, `${this.$players.name(p)} ^3has been unbanned`);

    blames.push(null);
  }

  async ['SUP cheat <on|off>: Cheat mode (use to enable </r_shownormals 1> etc.)']({as, blames, args: [par]}) {
    const sysCfg = await this.urt4.rpc('sv getcfg 1');
    const value = this.urt4.getBoolean(par);
    const cheatCfg = sysCfg.replace(/\\sv_cheats\\\d/, `\\sv_cheats\\${value}`);
    const cmds = this.urt4.clientCfg(as.client, 1, cheatCfg);
    this.urt4.cmds(cmds);
    return `^3Your cheat mode changed to ${value ? '^2ON' : '^1OFF'}`;
  }

  async ['MOD+ banlist [<before>]: List last bans (or before some date YYYY-MM-DD)']({as, blames, args: [before]}) {
    const ban = 'settings.punish.ban';
    const since = `${ban}.since`;
    const query = {};
    const limit = 10;

    if (before) {
      const date = +new Date(before);
      if (isNaN(date)) return '^1Error ^5before ^3must be a date';
      query[since] = {$lte: date};
    }

    const list = await this.$db.$users.model.find(
      query,
      {auth: 1, name: 1, [ban]: 1, lastIp: 1, 'settings.authInfo': 1}
    ).sort({[since]: -1}).limit(limit).lean().exec();

    if (!list.length) return '^2No bans found';

    const result = [before ? `^2${limit} bans before ${before}:` : `Last ${limit} bans`];

    for (const item of list) {
      const name = item.name[item.name.length - 1];

      const id = (
        this.$.get(item, 'settings', 'authInfo', 'addon') ||
        item.auth[0] ||
        item.lastIp
      );

      const {byAuth, since, permanent, until, reason} = this.$.get(item, 'settings', 'punish', 'ban') || {};
      const dateStr = new Date(since).toISOString();
      const datePr = `${dateStr.substr(0, 10)} ${dateStr.substr(11, 5)}`;
      const now = +new Date();
      const period = permanent ? '^1permanent' : until <= now ? '^2finished' : `^3for ${this.urt4.showTimeSpan(until - since)}`;
      result.push(`^2@${datePr} ^3by ^5${byAuth} ${period} ^7: ${name} ^5[${id}^5]`);
      result.push(`  ^2\\ Reason: ^7${reason}`);
    }

    return result;
  }

  async ['TMOD+ mute <player> [<time>|unmute]: Mutes/unmutes the player']({as, blames, args: [player, time]}) {
    const p = this.$players.find(player, as, true);
    if (p.level >= as.level) blames.push(p);
    const now = +new Date();
    const msec = this.urt4.getTimeSpan(time);
    const lvl = this.admin.$.levelNames[as.level];
    const lvlMsec = this.$.levelMsecLimits[lvl];

    if (msec) {
      if (msec > lvlMsec) return `^1Error ^3Maximum mute period you may set is ^2${this.urt4.showTimeSpan(lvlMsec)}`;

      const mute = {
        since: now,
        until: now + msec,
        by: as.dbId, byAuth: as.auth
      };

      await this.$players.set(p, {'punish.mute': mute});
    } else {
      await this.$players.unset(p, {'punish.mute': 1});
    }

    this.urt4.cmd(`com in mute ${p.client} ${parseInt(msec / 1000)}`);

    this.$players.chat(null, `${this.$players.name(p)} ^3has been ${msec ? `muted for ^5${
      this.urt4.showTimeSpan(msec)
    }` : 'unmuted'}`);

    blames.push(null);
  }

  async ['SUP+ setname <player> [<...name>] : Force player name (use \'+\' to remove lock) / check it']({as, blames, args: [player, ...names]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as);

    if (!names.length) {
      const has = this.$.get(p, 'punish', 'name');

      return `^3Player ${this.$players.name(p)} has ${
        has ? `forced name ^2${has}` : '^2no^3 forced name'
      }`;
    }

    let name = names.join(' ');
    if (name === '+') name = '';
    await this.$players.set(p, {'punish.name': name});
    if (name) this.urt4.cmd(`sv clvar ${p.client} name ${name}`);

    blames.push(null);
    this.$players.chat(null, `^3Player ${this.$players.name(p)}^3 got ${name ? `forced name ^2${name}` : '^2no^3 forced name'}`);
  }


  async ['TMOD+ slap <player> [<reason>]: Slaps a player']({as, blames, args: [player, reason]}) {
    const p = this.$players.find(player, as, true);
    blames.push(null);
    this.urt4.cmd(`com in slap ${p.client}`);
    return `^3You have just slapped ${this.$players.name(p)}`;
  }

  async ['ANY slot <player>: Take slot of unauthorized player']({as, blames, args: [player]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    if (!as.auth) return `^1Error ^3You have no auth`;

    if (this.$.get(as, 'sets', 'player', 'teamDenyAll')) {
      return `^1Error ^3You are not allowed to ^2choose a team^3`;
    }

    const p = this.$players.find(player, as);
    blames.push(null);

    const team = this.$.get(p, 'info2', 't');

    if (!(team in this.$players.$.playingTeam)) {
      return `^1Error ^3Player ${this.$players.name(p)} is not playing`;
    }

    if (p.auth) return `^1Error ^3Player ${this.$players.name(p)} is authorized: ^2${p.auth}`;

    await this.$players.forceTeam(p, this.$players.$.teamNames[this.$.get(as, 'info2', 't')]);
    await this.$players.forceTeam(as, this.$players.$.teamNames[team]);

    this.$players.chat(null, `^3Slot of ${this.$players.name(p)} has been taken by ^2${this.$players.name(as)}`);
    return `^3You took slot of ${this.$players.name(p)}`;
  }

  async ['MOD+ toss <player> [<times>]: Toss a player']({as, blames, args: [player, times]}) {
    const p = this.$players.find(player, as, true);
    blames.push(null);
    this.urt4.cmd(`com in nuke ${p.client}`);
    const t = times | 0 || 1;

    for (let i = 0; i < t; i++) {
      this.urt4.cmd(`sv ps ${p.client} velo 0 0 10000`);
      await this.$.delay(100);
    }

    //this.urt4.cmd(`sv clcmd ${p.client} 1 kill`);

    //this.urt4.cmd(`sv ps ${p.client} velo 0 0 -3000`);

    return `^3You have just tossed ${this.$players.name(p)}`;
  }

  async ['MOD+ nuke <player>: Nuke a player']({as, blames, args: [player, reason]}) {
    const p = this.$players.find(player, as, true);
    blames.push(null);
    this.urt4.cmd(`com in nuke ${p.client}`);
    return `^3You have just nuked ${this.$players.name(p)}`;
  }

  async ['TMOD+ kick <player> [<reason>]: Kicks a player']({as, blames, args: [player, ...reasons]}) {
    const p = this.$players.find(player, as, true);
    if (p === as) return `^1Error ^3You can't kick yourself`;
    const now = +new Date();
    if (now < as.$kickLock) return `^1Error ^3You can't kick at this time`;
    const whom = this.$players.name(p);
    const reason = reasons.join(' ');

    (async () => {
      if (p.level >= as.level) {
        const kickIn = 20;
        as.$kickLock = now + kickIn * 1000;
        this.$players.chat(as, `${whom} will be kicked in ^2${kickIn}^5 seconds if OK`);

        const vote = await this.$votes.vote(p, {
          text:
            `^6Warning ${this.$players.name(as)} tries to ^5kick^3 you` +
            (reason ? ` (reason: ^5${reason}^3)`: '') +
            `. Do you want to prevent this?`,
          time: kickIn
        });

        if (vote.yes) {
          //TODO: offer to apply penalty
          as.$kickLock = +new Date() + 180000;
          this.$players.chat(as, `^1Error ^3Player ^5${whom}^3 prevented the kick attempt`);
          return;
        } else {
          as.$kickLock = null;
        }
      }

      blames.push(null);

      this.$players.kick(p, reason);
      this.$players.chat(null, `^3Player ${whom}^3 has been ^2kicked`);
    })();
  }
}

Punish.levelMsecLimits = {
  tmod: 10 * 60 * 1000,
  mod: 7 * 24 * 60 * 60 * 1000,
  sup: 50 * 7 * 24 * 60 * 60 * 1000,
  admin: 5000 * 7 * 24 * 60 * 60 * 1000,
  console: 5000 * 7 * 24 * 60 * 60 * 1000
};

Punish.nSpamMuteScore = 2;
Punish.msecSpamMute = 30000;
Punish.msecSpamMuteGap = 2000;
Punish.rxSpamMuteCmd = /^ut_radio\s/;

module.exports = Punish;
