const Cmd = require('./cmd');

class Votes extends Cmd {
  async init(deps) {
    this.nextId = 0;

    await deps({
      ...this.$.pick(this.admin, '$players', '$mod')
    });
  }

  async getServerTime() {
    const svTime = +await this.urt4.rpc('sv gettime');
    return svTime;
  }

  async addVote(playersSrc, voteObj) {
    const {$players} = this.admin;
    const players = $players.getPlayers(playersSrc);
    if (!players || !players.length) return null;

    const vote = voteObj !== 'object' ? voteObj : {text: voteObj};
    vote.yes |= 0;
    vote.no |= 0;
    vote.voted = vote.yes + vote.no;
    vote.max = players.length + vote.yes + vote.no;

    vote.promise = new Promise((resolve) => {
      vote.resolve = resolve;
    });

    const svTime = await this.getServerTime();

    for (const player of players) {
      let votes = player.$votes;
      if (!votes) player.$votes = votes = {active: [], voted: [], penaltyPoints: 0};
      if (votes.voted.indexOf(voteObj) < 0 && votes.active.push(vote) === 1) this.startVote(player, svTime);
    }

    return vote;
  }

  startVote(player, serverTime) {
    const {$players} = this.admin;
    const votes = player.$votes;
    if (!votes) return;
    
    const vote = votes.active[0];
    if (!vote) return this.showVote(player, serverTime);
    if (!vote.ends) vote.ends = {};
    if (vote.ends[player.client]) return this.showVote(player, serverTime);


    const now = +new Date();
    const msec = (vote.time || this.$.hardTime) * 1000;
    vote.ends[player.client] = now + msec;
    this.showVote(player, serverTime);
    vote.started = true;

    (async () => {
      await this.$.delay(msec);

      if ($players.clients[player.client] !== player) return;

      if (votes.active[0] === vote) {
        votes.active.shift();
        vote.voted++;

        if (vote.voted >= vote.max) {
          vote.complete = true;
          vote.resolve();
        }
      } else {
        const idx = votes.voted.indexOf(vote); 
        if (idx >= 0) votes.voted.splice(idx, 1);
      }

      await this.startVote(player);
    })();
  }

  hideVote(player) {
    this.urt4.cmd(`sv svcmd ${player.client} cs ${this.$.cs.time}`);
  }

  async showVote(player, serverTime) {
    const votes = player.$votes;
    if (!votes) return;
    const vote = votes.active[0] || votes.voted[0];
    if (!vote || !vote.ends) return this.hideVote(player);
    const svTime = serverTime || await this.getServerTime();
    const now = +new Date();
    const msec = vote.ends[player.client] - now;
    const obj = {...vote, time: svTime - this.$.hardTime + msec};

    this.urt4.cmds(
      Object.entries(this.$.cs)
      .map(([key, csId]) => `sv svcmd ${player.client} cs ${csId} ${obj[key]}`)
    );
  }

  async vote(players, voteObj) {
    const vote1 = await this.addVote(players, voteObj);
    if (!vote1) return null;
    if (voteObj.onReady) voteObj.onReady.call(this, voteObj);
    await vote1.promise;
    return vote1;
  }

  voteRefresh(vote) {
    const {$players} = this.admin;

    for (const player of Object.values($players.clients)) {
      const votes = player.$votes;
      if (!votes) continue;
      if (votes.active[0] === vote || votes.voted[0] === vote) this.showVote(player);
    }
  }

  voteReply(player, reply, vote) {
    const votes = player.$votes;
    if (!vote) vote = votes && votes.active[0];
    if (!vote) return null;

    const level = this.admin.$.levelIds[player.level | 0];

    if (reply) {
      const weight = this.$.weights[level];
      vote[reply] += weight;
      this.$players.chat(player, `^5Info ^3Your vote weight is ^2${weight}`);
      vote.voted++;
    }

    if (vote === votes.active[0]) votes.active.shift();
    this.startVote(player);

    if (vote.voted >= vote.max) {
      vote.complete = true;
      vote.resolve();
    } else {
      if (vote.keep) votes.voted.push(vote);
    }

    this.voteRefresh(vote);
    return vote;
  }

  execCallback(cb, vote) {
    if (cb instanceof Array) return cb.map(a => this.execCallback(a, vote));
    return cb.call(this, vote);
  }

  async voteForModeMapText(vote) {
    const {$mod} = this.admin;
    const texts = [];
    const subj = vote.subj;
    let modeObj = null;

    if (subj.mode) {
      modeObj = $mod.modes[subj.mode];

      if (modeObj) {
        texts.push(`^7Change game mode to ^3${modeObj.desc}^7?`);
      }
    }

    if (subj.map) {
      texts.push(`^7Change map to ^3${subj.map}^7?`);
    } else {
      if (subj.restart) {
        texts.push(`^7Restart map ^3${$mod.map}^7?`);
      } else {
        const curNextMap = await this.urt4.rpc('com getcvar g_nextmap');
        let nextmap = subj.nextmap;

        if (nextmap) {
          texts.push(`^3Set next map to ^7${nextmap}^3?`);
          this.$players.chat(null, `^3Currently ^2next map^3 is set to ^5${curNextMap}`);
        }

        if (!nextmap) {
          nextmap = curNextMap;

          if (modeObj && !(nextmap in modeObj.maps)) {
            nextmap = $mod.findNextMap($mod.map, subj.mode);
          }
        }

        if (subj.cyclemap) texts.push(`^3Cycle map to ^7${nextmap}^3?`);
      }
    }

    vote.text = texts.join('; ');
  }

  voteForModeMapExec(vote) {
    const {$mod} = this.admin;
    const subj = vote.subj;
    if (subj.mode) $mod.setNextMode(subj.mode);
    if (subj.map) $mod.changeMap(subj.map)

    else {
      if (subj.restart) {
        this.urt4.cmd('com in map_restart');
      } else {
        if (subj.nextmap) $mod.setNextMap(vote.subj.nextmap);
        if (subj.cyclemap) this.urt4.cmd('com in cyclemap');
      }
    }
  }

  voteGetModeMapPreview(as) {
    const vote = as.$votes && as.$votes.active[0];
    if (vote && vote.preview && vote.group === 'mode+map') return vote;
    return null;
  }

  async voteForModeMap(as, voteSrc) {
    const {$players} = this.admin;

    const now = +new Date();
    const until = this.$.get(as, 'votes', 'disallowUntil');

    if (until && now < until) {
      return `^1Error ^3You are disallowed to start voting for next ^2${
        this.urt4.showTimeSpan(until - now)
      }`;
    }

    if (as.$votes) {
      const msec = (this.$.msecVoteFailPenalty * as.$votes.penaltyPoints) - (now - as.$votes.failedAt);

      if (msec > 0) {
        return `^1Error ^3You may not start the vote for next ^2${
          this.urt4.showTimeSpan(msec)
        }^3 due to failed votes in past`;
      }

      const active = as.$votes.active[0];

      if (as.$votes.voted.length || (active && !active.preview)) {
        return `^1Error ^3You may not start the vote because you have another vote in progress`;
      }
    }

    let ready;
    const wait = new Promise((resolve) => {ready = resolve;});

    (async () => {
      voteSrc.starter = as;
      let vote = this.voteGetModeMapPreview(as);

      $players.chat(as, `^5Please confirm or upgrade your vote`);

      if (vote) {
        for (const key in voteSrc.subj) {
          if (voteSrc.subj[key] !== vote.subj[key]) {
            vote.subj[key] = voteSrc.subj[key];
          } else {
            // delete vote.subj[key]; // uncomment to toggle votes
          }
        }

        await this.voteForModeMapText(vote);
        ready();
        return await this.showVote(as);
      } else {
        await this.voteForModeMapText(voteSrc);
      }

      vote = await this.vote(as, {...voteSrc, preview: true, keep: false, time: this.$.secVotePreview, onReady: ready, starter: as});
      if (!vote.yes) return $players.chat(as, `^5You have ^1not confirmed^5 the vote for ''^2${vote.text}^5'' `);

      const players = $players.getActivePlayers();
      const idx = players.indexOf(as);
      if (idx >= 0) players.splice(idx, 1);

      if (players.length > 0) {
        $players.chat(as, `^5You have ^2confirmed^5 the vote for ''^2${vote.text}^5''. Now it's public`);
        $players.chat(null, `^5${$players.name(as)} started the vote for ''^2${vote.text}^3'' `);
        if (!as.$votes) as.$votes = {};
        vote = {...vote, preview: false, ends: {}, yes: 0, keep: true, time: this.$.secVotePublic};
        await this.voteForModeMapText(vote);
        players.push(as);
        vote = await this.addVote(players, vote);
        if (as.$votes.active[0] === vote) this.voteReply(as, 'yes');
        await vote.promise;
      }

      const success = vote.yes > vote.no;

      if (success) {
        as.$votes.penaltyPoints = 0;
        this.voteForModeMapExec(vote);
      } else {
        as.$votes.failedAt = +new Date();
        as.$votes.penaltyPoints++;
      }

      $players.chat(null, `^3Voting for ''^7${vote.text}^3'' ` +
        `has ${success ? '^2passed' : '^1failed'}`);
    })();

    await wait;
  }

  async voteForMode(as, mode) {
    const {$players, $mod} = this.admin;
    const cur = await this.urt4.rpc('com getcvar nodeurt_mode');

    const modeObj = $mod.modes[mode];
    if (mode === cur) return `^1Error ^3Already playing ^2${modeObj.desc}`;

    if (!await $mod.checkGameAccess(as, modeObj)) return this.admin.$.cmdErrors.access;

    const curVote = this.voteGetModeMapPreview(as);

    let map;

    if (curVote) {
      map = curVote.subj.map;
      if (!map) map = curVote.subj.restart && $mod.map;
      if (!map) map = curVote.subj.nextmap;
    }

    const maplist = await $mod.gameMaps('', modeObj.mapObjs);
    $players.chat(as, maplist);

    if (map && modeObj.maps.indexOf(map) < 0) {
      return `^1Error ^3The desired map is not enabled in this mode`;
    }

    const vote = {subj: {mode}, group: 'mode+map'};
    const result = await this.voteForModeMap(as, vote);
    return result;
  }

  async voteForMap(as, map) {
    const {$mod} = this.admin;
    if (map === $mod.map) return `^1Error ^3Already playing map ^2${map}`;
    const vote = {subj: {map}, group: 'mode+map'};
    const result = await this.voteForModeMap(as, vote);
    return result;
  }

  async voteForNextMap(as, nextmap) {
    const {$mod} = this.admin;
    const cur = await this.urt4.rpc('com getcvar g_nextmap');
    if (nextmap === cur) return `^1Error ^3Next map is already set to ^2${nextmap}`;
    const vote = {subj: {nextmap}, group: 'mode+map'};
    const result = await this.voteForModeMap(as, vote);
    return result;
  }

  async voteForCycleMap(as) {
    const {$mod} = this.admin;
    const vote = {subj: {cyclemap: true}, group: 'mode+map'};
    const result = await this.voteForModeMap(as, vote);
    return result;
  }

  async voteForRestart(as) {
    const {$mod} = this.admin;

    const curVote = this.voteGetModeMapPreview(as);

    if (curVote) {
      const mode = curVote.subj.mode;
      const modeObj = $mod.modes[mode];

      if (modeObj && modeObj.maps.indexOf($mod.map) < 0) {
        return `^1Error ^3Current map is not enabled in desired game mode`;
      }
    }

    const vote = {subj: {restart: true}, group: 'mode+map'};
    const result = await this.voteForModeMap(as, vote);
    return result;
  }

  findMapWithVote(map, as) {
    const {$mod} = this.admin;
    let maps;
    const vote = this.voteGetModeMapPreview(as);

    if (vote) {
      const mode = vote.subj.mode;
      if (mode) maps = $mod.modes[mode].mapObjs;
    }

    const found = $mod.findMap(map, maps);
    return found;
  }

  // CMD

  async ['ANY vote [<vote>] [...]: Reply for current vote / start vote'](
    {as, blames, args}
  ) {
    if (!args.length) return [
      '^2Available options:',
      '^5vote yes ^3; ^5vote no ^3-- reply to current vote;',
      '^5vote <game> ^3-- Start voting for next game mode;',
      '^5vote map <map> ^3; ^5vote <map> ^3-- Start voting for map change;',
      '^5vote next <map> ^3; ^5vote nextmap <map> ^3-- Start voting for next map.',
      '^5vote cycle ^3; ^5vote cyclemap ^3-- Start voting for cyclemap.',
      '^5vote restart ^3 -- Start voting for map restart.',
      '^2Where:',
      '  <map> -- is part of map name or map ID # from ^5!maps^3 output;',
      '  <game> -- exact game ID string as it appears in ^5!games^3 output.'
    ];

    if (!as.auth) return `^1Error ^3Unauthorized players may not start the vote`;

    const {$players, $mod} = this.admin;

    let reply;

    while ((reply = args.shift())) {
      if (reply in this.$.replies) {
        const vote = this.voteReply(as, reply);
        if (!vote) return '^1Error ^3There is no active votes for you';
        return `^5Vote "^7${vote.text}^5". ^3You have voted ${reply === 'yes' ? '^2for' : '^1against'}`;
      }

      if (reply in $mod.modes) {
        $players.chat(as, await this.voteForMode(as, reply));
      } else if (reply === 'map') {
        const map = this.findMapWithVote(args.shift(), as);
        $players.chat(as, await this.voteForMap(as, map));
      } else if (reply === 'next' || reply === 'nextmap') {
        const nextmap = this.findMapWithVote(args.shift(), as);
        $players.chat(as, await this.voteForNextMap(as, nextmap));
      } else if (reply === 'cycle' || reply === 'cyclemap') {
        $players.chat(as, await this.voteForCycleMap(as));
      } else if (reply === 'restart' || reply === 'restartmap') {
        $players.chat(as, await this.voteForRestart(as));
      } else {
        const map = this.findMapWithVote(reply, as);
        $players.chat(as, await this.voteForMap(as, map));
      }
    }
  }

  async ['ANY callvote <...condition or command>: Start voting']({as, blames, args: [cmd, arg]}) {
    const {$mod} = this.admin;

    if (!cmd) {
      return '^1Warning ^5callvote^3 is limited to support voting GUI. Please use ^5vote^3 command instead';
    }

    if (!as.auth) return `^1Error ^3Unauthorized players may not start the vote`;

    if (cmd in $mod.$.preSetsRating) {
      const mode = await $mod.detectMode({[cmd]: arg});
      if (!mode) return '^1Error ^3This game mode is not enabled';
      return await this.voteForMode(as, mode);
    }

    if (cmd in $mod.modes) return await this.voteForMode(as, cmd);
    if (cmd === 'cyclemap') return await this.voteForCycleMap(as);
    if (cmd === 'restart') return await this.voteForRestart(as);

    if (cmd === 'map') {
      const map = this.findMapWithVote(arg, as);
      return await this.voteForMap(as, map);
    }

    if (cmd === 'nextmap') {
      const nextmap = this.findMapWithVote(arg, as);
      return await this.voteForNextMap(as, nextmap);
    }

    //if (cmd ===

    return '^3This vote is disabled';
  }

  async ['TMOD veto [<time>]: Disallow current voting and optionally disable voter for given time']({as, blames, args: [time]}) {
    const votes = as.$votes;
    const vote = votes && (votes.active[0] || votes.voted[0]);
    if (!vote) return `^1Error ^3No vote in progress to cancel`;
    vote.voted = vote.max;
    vote.yes = vote.no = 0;
    this.voteReply(as, null, vote);

    if (time) {
      const {$players} = this.admin;
      const msec = this.urt4.getTimeSpan(time);
      const now = +new Date();
      await $players.set(vote.starter, {'votes.disallowUntil': now + msec});
      $players.chat(null, `^3Player ${$players.name(vote.starter)}^3 has his voting disabled for ^2${this.urt4.showTimeSpan(msec)}`);
    }

    blames.push(vote.starter);
    return `^3You have cancelled the vote "^7${vote.text}^3"`;
  }

  async ['MOD votein [<player>] [<time>]: Set/get next allowed voting time '](
    {as, blames, args: [player, time]}
  ) {
    const {$players} = this.admin;
    const p = $players.find(player, as, true);
    const now = +new Date();

    if (!time) {
      const until = this.$.get(p, 'votes', 'disallowUntil');

      return `^3Player ${$players.name(p)}^3 has his voting ^2${
        until ? `disabled for ${this.urt4.showTimeSpan(until - now)}` : 'enabled'
      }`;
    }

    if (p.$votes) p.$votes.penaltyPoints = 0;
    const msec = this.urt4.getTimeSpan(time);

    if (!msec) {
      await $players.unset(p, {'votes.disallowUntil': 1});
      $players.chat(null, `^3Player ${$players.name(p)}^3 can start voting now`);
      return;
    }

    await $players.set(p, {'votes.disallowUntil': now + msec});

    $players.chat(null, `^3Player ${$players.name(p)}^3 can start voting in ^2${this.urt4.showTimeSpan(msec)}`);
  }
}

// Vote object: { id, time, text, yes, no }
// $votes: {public: [], private: [], voted: {id: vote}}

Votes.cs = {time: 8, text: 9, yes: 10, no: 11};
Votes.hardTime = 30000;
Votes.replies = {yes: 1, no: 2};
Votes.msecVoteFailPenalty = 20000;
Votes.secVotePreview = 40;
Votes.secVotePublic = 20;

Votes.weights = {
  any: 1,
  user: 2,
  tmod: 3,
  mod: 3,
  sup: 4,
  admin: 4,
  console: 4
};

module.exports = Votes;
