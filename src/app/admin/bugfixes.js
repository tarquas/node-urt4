const {Emitter} = require('clasync');

class Bugfixes extends Emitter {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$players', '$pos', '$qvm')
    });

    this.$qvm.on('auth', this.onAuth.bind(this), true);
    this.$players.on('info2', this.onInfo2.bind(this));
    this.$players.on('user', this.onUser.bind(this));
    this.sv.on('clcmd', this.onClCmd.bind(this));
    this.sv.on('svcmd', this.onSvCmd.bind(this), true);
    this.sv.on('drop', this.onDrop.bind(this), true);
    this.sv.on('drop', this.onMustDrop.bind(this));

    this.specUpdateProc = this.specUpdate.bind(this);
    this.specUpdateProc();
  }

  async specUpdate() {
    try {
      const {$players, $pos} = this;
      if (!$players) return;
      const clients = Object.values($players.clients);
      const specs = clients.filter(p => !p.dropped && this.$.get(p, 'info2', 't') === '3');

      const specIds = specs.map(p => p.client);
      const specStates = await this.urt4.rpcs(specIds.map(id => `sv getps ${id}`));
      const states = this.$.zipObject(specIds, specStates.map($players.getState));

      for (const p of specs) {
        const pi = states[p.client].player;

        if (pi && pi[$pos.$.playerIsFollowing] && !p.hidden) {
          const whom = $players.clients[pi[$pos.$.playerFollows]];
          if (whom) p.following = whom;
        } else {
          delete p.following;
        }

        this.onInfo2({client: p.client});
      }

      const specers = this.$.groupBy(specs, p => this.$.getDef(p, 'following', 'client', 'none'));

      for (const [client, speced] of Object.entries(specers)) {
        const p = $players.clients[client];
        if (!p) continue;
        const names = speced.map(s => $players.name(s));
        const status = ` ... ^1watched by: ${names.join('^7; ')}`;
        const sps = [p/*, ...speced*/]; // for watchers don't show other watchers

        for (const p2 of sps) {
          this.setLocationInfoText(p2, status);
        }
      }

      for (const p of clients) {
        if (p.client in specers) continue;
        this.setLocationInfoText(p, '');
      }
    } finally {
      setTimeout(this.specUpdateProc, this.$.specUpdateMsec);
    }
  }

  async onAuth(args) {
    const {client, auth} = args;
    const {$players} = this;
    const player = $players.clients[client];
    if (!player) return;
    const authl = this.$.get(player, 'info', 'authl') || '';
    if (player.localIp && auth !== authl) args.auth = authl; //fix overridden auth for local ip
  }

  async onClCmd({cmd, client}) {
    const {$players} = this;
    const player = $players.clients[client];

    // chickenfix for SR8 and FR-F1 drop bug
    if (cmd === 'ut_weapdrop 14' || cmd === 'ut_weapdrop 23') {
      // set current weapon to pistol and weapon state to zero and ensure this in a little while
      $players.setPlayerState(player, {weapon: [0, 0]});
      await this.$.tick();
      $players.setPlayerState(player, {weapon: [0, 0]});
    }
  }

  getPrettyNameInfo2Str(p, player) { // p - to whom, player - whom
    const {$players} = this;
    let name = `${player.info.name}`;

    if (this.urt4.getBoolean(this.$.get(p, 'prefs', 'noNameColor'))) {
      name = this.urt4.noColor(name);
    }

    if (this.$.get(player, 'info2', 't') == 3) {
      if (player.hidden) {
        name = ' ^7 ';
      } else {
        name += ` ${$players.prettifyAuth(p, player, null, true)}`;

        if (player.following && !this.urt4.getBoolean(this.$.get(p, 'prefs', 'noWatchInfo'))) {
          name += ` ^7specs ^3${$players.ncname(player.following)}`;
        } else {
          name += ` ${$players.levelName(player.level)}`;
        }
      }
    }

    const info2 = {...player.info2, n: name};
    const info2str = $players.makeInfo(info2).substr(1);
    let last = player.lastInfo2Str;
    if (!last) player.lastInfo2Str = last = new WeakMap();
    if (last.get(p) === info2str) return null;
    last.set(p, info2str);
    return info2str;
  }

  async onInfo2({client}) {
    const {$players} = this;
    while (!$players.cfgMap) await this.$.delay(100);
    const player = $players.clients[client];
    if (!player) return 0;

    const needColor = (
      Object.values($players.clients)
      .filter((p) => (
        !p.dropped/* && (
          (p.hidden && this.$.get(p, 'info2', 't') === '3') ||
          !this.urt4.getBoolean(this.$.get(p, 'prefs', 'noNameColor'))
        )*/
      ))
    );

    const cmds = needColor.map((p) => {
      const info2str = this.getPrettyNameInfo2Str(p, player);
      if (info2str == null) return null;
      return `sv svcmd ${p.client} cs ${$players.cfgMap.players + client} ${info2str}`;
    }).filter(this.$.echo);

    if (cmds.length) this.urt4.cmds(cmds);

    return 0;
  }

  async onUser({player}) {
    //if (this.urt4.getBoolean(this.$.get(player, 'prefs', 'noNameColor'))) return 0;
    const {$players} = this;
    const players = Object.values($players.clients).filter(p => !p.dropped);

    const cmds = (
      players.map(p => [p, this.getPrettyNameInfo2Str(player, p)])
      .filter(([p, i]) => i != null)
      .map(([p, i]) => `sv svcmd ${player.client} cs ${$players.cfgMap.players + p.client} ${i}`)
    );

    if (cmds.length) this.urt4.cmds(cmds);
    return 0;
  }

  setLocationInfoText(player, text) {
    let loc = player.gameLocation;
    if (!loc) player.gameLocation = loc = {};
    if (text != null) loc.infoText = text; else text = loc.infoText;
    if (this.urt4.getBoolean(this.$.get(player, 'prefs', 'noWatchInfo'))) text = '';

    if (loc.name != null) {
      const locCmd = `sv svcmd ${player.client} cs ${+loc.id + 640} ${loc.name} ${text || ''}`;
      if (player.lastLocCmd === locCmd) return;
      player.lastLocCmd = locCmd;
      this.urt4.cmd(locCmd);
    }
  }

  async onSvCmd(args) {
    const {cmd, client} = args;

    if (this.$.rxBadChallengeBroad.test(cmd)) {
      // don't broadcast bad challenge now
      return true;
    }

    const {$players, $} = this;
    const player = $players.clients[client];
    if (!player) return false;

    {
      const [, location] = cmd.match(this.$.locationCmd) || [];

      if (location) {
        const locName = await this.urt4.rpc(`sv getcfg ${+location + 640}`);
        let loc = player.gameLocation;
        if (!loc) player.gameLocation = loc = {};
        Object.assign(loc, {id: location, name: locName});

        if (this.$.get(player, 'info2', 't') !== '3') {
          this.setLocationInfoText(player);
        }

        return false;
      }

      const [, scoresHead, scoresCmd] = cmd.match(this.$.rxScoresCmd) || [];

      if (scoresCmd) {
        const items = scoresCmd.match(this.$.rxScoresItems);

        if (items) {
          const [, nScores, redCaps, blueCaps] = scoresHead.match(this.$.rxScoresHead) || [];
          let ns = nScores ? nScores | 0 : 1;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let [, slot, scores, auth] = item.match(this.$.rxScoresItem) || [];

            if (!scores) continue;
            const p = $players.clients[slot];
            if (!p) continue;

            if (p.hidden && this.$.get(p, 'info2', 't') === '3') {items[i] = ''; ns--;}

            // display overridden auth
            if (auth === '---' && p.auth) auth = `${p.auth}`;

            auth = $players.prettifyAuth(player, p, auth);

            items[i] = ` ${slot} ${scores} ${auth}`;
          }

          if (nScores) {
            args.cmd = `scores ${ns} ${redCaps} ${blueCaps}${items.join('')}`;
          } else {
            if (ns <= 0) return true;
            args.cmd = `${scoresHead}${items.join('')}`;
          }
        }

        return false;
      }
    }

    return false;
  }

  async onDrop({client, reason, message, by}) {
    const {$players, $qvm} = this;
    const player = $players.clients[client];

    // allow auth login in local intranet
    if (by === 'auth' && player.localIp) {
      await $qvm.emit('auth', {client});
      return true;
    }
  }

  async onMustDrop({client, reason, message}) {
    // make sure client gets the drop packet with message
    this.urt4.cmd(`sv svcmd ${client} disconnect "${message || reason}"`);
    await this.$.tick();
  }
}

Bugfixes.rxBadChallengeBroad = /^print \"\^5\[auth\] \^7(.*) is \^1rejected\^7 for \^1bad challenge\^7 error\n"/;
Bugfixes.rxScoresCmd = /^(scores \d+ [\d-]+ [\d-]+|scoress|scoresd)( .*)$/;
Bugfixes.rxScoresHead = /^scores (\d+) ([\d-]+) ([\d-]+)$/;
Bugfixes.rxScoresItems = / ([\d-]+) ([\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+ [\d-]+) (\w+|---)/g;
Bugfixes.rxScoresItem = new RegExp(Bugfixes.rxScoresItems.source);

Bugfixes.locationCmd = /^location (\d+)/;
Bugfixes.specUpdateMsec = 2000;

module.exports = Bugfixes;


/*
second half

SVCMD 2 cs 21 "1263250"

SVCMD 3 cs 21 "1263250"

SVCMD 2 cs 24 "1383250"

SVCMD 3 cs 24 "1383250"

~raw sv getcfg 21 -- when half started
~raw sv getcfg 24
~raw sv gettime
~raw sv gettime2

HEALER MOD

*/