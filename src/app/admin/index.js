const shq = require('shell-quote');
const Clasync = require('clasync');

const Bugfixes = require('./bugfixes');
const Dbg = require('./dbg');
const Menu = require('./menu');
const Mod = require('./mod');
const Players = require('./players');
const Pos = require('./pos');
const Punish = require('./punish');
const Qvm = require('./qvm');
const Votes = require('./votes');
const Inv = require('./inv');
const Info = require('./info');

class Admin extends Clasync {
  static get type() { return 'admin'; }

  async init(sub) {
    this.cmds = {};
    this.modCmds = {};
    this.players = {};
    const cfg = {urt4: this.urt4, $db: this.urt4.$db};

    await sub({
      $bugfixes: Bugfixes.sub(cfg),
      $dbg: Dbg.sub(cfg),
      $menu: Menu.sub(cfg),
      $mod: Mod.sub(cfg),
      $players: Players.sub(cfg),
      $pos: Pos.sub(cfg),
      $punish: Punish.sub(cfg),
      $qvm: Qvm.sub(cfg),
      $votes: Votes.sub(cfg),
      $inv: Inv.sub(cfg),
      $info: Info.sub(cfg)
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
      const result = await cmdObj.handler.call(cmdObj.context, {...custom, cmd, args, as});
      return result;
    } catch (err) {
      if (err instanceof Error) {
        this.$.throw(err, `CMD cmd`);
        return '^2<internal error>';
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
  user: '^5registered user',
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
