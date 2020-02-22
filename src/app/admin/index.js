const shq = require('shell-quote');

const {$} = require('clasync');

const Bugfixes = require('./bugfixes');
const Stats = require('./stats');
const Dbg = require('./dbg');
const DbgEnt = require('./dbg-ent');
const Follow = require('./follow');
const FunPak = require('./fun-pak');
const Hits = require('./hits');
const Hitpoints = require('./hitpoints');
const Menu = require('./menu');
const Mod = require('./mod');
const Party = require('./party-ctf');
const Players = require('./players');
const Pos = require('./pos');
const Punish = require('./punish');
const Qvm = require('./qvm');
const Votes = require('./votes');
const Inv = require('./inv');
const Info = require('./info');

class Admin extends $ {
  static get type() { return 'admin'; }

  async init(deps) {
    this.cmds = {};
    this.modCmds = {};
    this.players = {};

    const cfg = {urt4: this.urt4, $db: this.urt4.$db};

    await deps({
      $bugfixes: Bugfixes.new(cfg),
      $stats: Stats.new(cfg),
      $dbg: Dbg.new(cfg),
      $dbgEnt: DbgEnt.new(cfg),
      $follow: Follow.new(cfg),
      $funPak: FunPak.new(cfg),
      $hits: Hits.new(cfg),
      $hitpoints: Hitpoints.new(cfg),
      $menu: Menu.new(cfg),
      $mod: Mod.new(cfg),
      $party: Party.new(cfg),
      $players: Players.new(cfg),
      $pos: Pos.new(cfg),
      $punish: Punish.new(cfg),
      $qvm: Qvm.new(cfg),
      $votes: Votes.new(cfg),
      $inv: Inv.new(cfg),
      $info: Info.new(cfg)
    });
  }

  parseArgs(line) {
    const ents = line.match(this.$.rxParseCmd) || [];
    const res = [];

    for (const ent of ents) {
      const pfx = ent.charAt(0);
      if (pfx !== '\'' && pfx !== '"') { res.push(ent); continue; }
      const len = ent.length;
      if (len < 2) continue;
      const sfx = ent.charAt(len - 1);
      if (pfx !== sfx) continue;
      let mid = ent.substr(1, len - 2);
      if (pfx === '\'') mid = mid.replace(this.$.rxEnsureQuotesEsc, '\\"');
      res.push(JSON.parse(`"${mid}"`));
    }

    return res;
  }

  async execCmd(as, line, custom) {
    let cmd;
    let argLine;
    let args;

    if (typeof line === 'object') {
      ({cmd, argLine, args} = line);
    } else {
      [, cmd, argLine] = line.match(this.$.rxCmdParse) || [];
    }

    if (!cmd) return this.$.cmdErrors.missing;
    const pcmd = cmd.toLowerCase();
    if (as.allowedCmds && !(pcmd in as.allowedCmds)) return this.$.cmdErrors.missing;
    const cmdObj = this.cmds[pcmd];
    if (!cmdObj) return this.$.cmdErrors.missing;
    if (as.level < cmdObj.level) return this.$.cmdErrors.access;

    if (!args) args = this.parseArgs(argLine);

    try {
      const result = await cmdObj.handler.call(cmdObj.context, {...custom, cmd, args, as, argLine});
      return result;
    } catch (err) {
      if (err instanceof Error) {
        this.$.throw(err, `CMD ${cmd}`);
        return '^1<internal error>';
      }

      return err;
    }
  }

  norm(s) {
    const d = (
      (s || '').toString()
      .replace(this.urt4.$.rxColor, '')
      .replace(this.$.rxNormLetters, '')
      .toLowerCase()
    );

    return d;
  }

  sortByIndex(a, b) {
    return a.index > b.index ? 1 : a.index < b.index ? -1 : 0;
  }
}

Admin.cmdErrors = {
  success: 0,
  missing: 1,
  access: 2,
  error: 3,
  help: 4
};

Admin.levels = {
  any: 0,
  user: 10,
  tmod: 20,
  mod: 30,
  sup: 40,
  admin: 50,
  console: 1000
};

Admin.levelIds = Admin.invert(Admin.levels);

Admin.levelNames = {
  any: '^3a guest',
  user: '^5known player',
  tmod: '^4temporary moderator',
  mod: '^2a moderator',
  sup: '^1a supervisor',
  admin: '^6administrator',
  console: '^1console administrator'
};

Admin.rxCmdParse = /^(\w+)\s*([\S\s]*)$/;
Admin.rxNormLetters = /[^a-zA-Z0-9]/g;
Admin.rxParseCmd = /""|''|".*?[^\\]"|'.*?[^\\]'|\S+/g;
Admin.rxEnsureQuotesEsc = /\\?"/g;

module.exports = Admin;
