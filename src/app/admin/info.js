const Cmd = require('./cmd');

class Info extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$qvm', '$mod', '$players')
    });

    this.$players.on('team', this.onTeam.bind(this));
  }

  async onTeam({player, teamId}) {
    if (teamId !== 'spec') return;
    if (this.$.get(player, 'prefs', 'noShowTips')) return;
    //if (this.$.get(player, '$info', 'tipsShown')) return;

    this.$players.chat(player, [
      '', '', '', '^3   W E L C O M E  ^5T O  P W N Z  !', '', '',
      '^7Quick commands: ^5!help^3 ; ^5!prefs^3 ; ^5!rules^3 ; ^5!vote^7 or use game menu^3',
      '^6E-]^7 Join our ^6Discord^7 -- please visit: ^3http://^5pwnz.pro',
      '^7Download ^6DEMOS^7 from ^5#game-chat^7 channel or PM our bot with ^2frag^7 or ^2jump',
    ]);

    //this.$.set(player, '$info', 'tipsShown', true);
  }

  async getRule(id) {
    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = this.$mod.modes[mode];
    const rules = modeObj.rules;
    if (!id) return rules.desc;
    const rule = rules.rules[id];
    if (!rule) return null;
    return rule;
  }

  async rulesCmd({as, args: [idArg, to]}) {
    if (!idArg) return await this.getRule();
    const id = (idArg + '').toLowerCase();
    const rule = await this.getRule(id);
    if (!rule) return `^1Error ^3Rule ^2${id}^3 is not found`;

    if (to) {
      if (as.level < this.admin.$.levels.mod) return this.admin.$.cmdErrors.access;
      const p = this.$players.find(to, as, true);
      this.$players.chat(p, `\n\n^5Please be advised that repeating violation of rules result in kick or ban`);
      this.$players.chat(p, `^1-------- RULE DESCRIPTION --------`);
      this.$players.chat(p, rule);
      this.$players.chat(p, `^1Warning ^2Please open console and attentively read above`);
      this.$players.chat(null, `^2Moderator^3 paid attention of ^5${this.$players.name(p)}^3 to rule ^2${id}^3`);
      return `^3Rule ^5${id}^3 has been sent to ${this.$players.name(p)}`;
    }

    return rule;
  }

  async ['ANY+ rules : List rules of this server'](arg) { return this.rulesCmd(arg); }
  async ['ANY+ rule <#> [<to>]: Show details for rule # (to player <to> or self)'](arg) { return this.rulesCmd(arg); }

  async ['MOD+ warn <to> <#>: Send rule # to player']({args: [to, num], ...rest}) {
    return this.rulesCmd({args: [num, to], ...rest});
  }
}

module.exports = Info;
