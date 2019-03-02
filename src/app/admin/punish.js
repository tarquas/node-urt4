const Cmd = require('./cmd');

class Punish extends Cmd {
  async init(sub) {
    await sub({
      ...this.$.pick(this.admin, '$players', '$votes')
    });

    this.$players.on('user', this.onUser.bind(this));
    this.$players.on('info', this.onInfo.bind(this));
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
    if (name) this.urt4.cmd(`sv clvar ${player.client} name ${name}`);
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
    if (!p.dropped) this.$players.kick(p, this.$players.banReason(ban));
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

  async ['SUP+ setname <player> [<...name>] : Force player name (use \'\' to remove lock) / check it']({as, blames, args: [player, ...names]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as);

    if (!names.length) {
      const has = this.$.get(p, 'punish', 'name');

      return `^3Player ${this.$players.name(p)} has ${
        has ? `forced name ^2${has}` : '^2no^3 forced name'
      }`;
    }

    const name = names.join(' ');
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

  async ['MOD+ toss <player> [<reason>]: Toss a player']({as, blames, args: [player, reason]}) {
    const p = this.$players.find(player, as, true);
    blames.push(null);
    this.urt4.cmd(`sv ps ${p.client} velo 0 0 10000`);
    return `^3You have just tossed ${this.$players.name(p)}`;
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

module.exports = Punish;
