const Cmd = require('./cmd');

class Info extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$qvm', '$mod', '$players')
    });

    this.$qvm.on('spawn', this.onSpawn.bind(this));
  }

  async onSpawn({client}) {
    const player = this.$players.clients[client];
    if (!player) return;

    if (this.$.get(player, 'prefs', 'noShowTips')) return;
    if (this.$.get(player, '$info', 'tipsShown')) return;

    this.$players.chat(player, [
      '^2Tip:^3 Write ^5!help^3 to list available commands',
      '^2Tip:^3 Use ^5!prefs^3 to view/adjust your preferences',
      '^2Tip:^3 Please read and respect our ^5!rules',
      '^2Tip:^3 Join our Discord. Please visit: http://^5pwnz.pro^3/'
    ]);

    this.$.set(player, '$info', 'tipsShown', true);
  }

  async rulesCmd({as, args: [idArg, to]}) {
    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = this.$mod.modes[mode];
    const rules = modeObj.rules;
    if (!idArg) return rules.desc;
    const id = (idArg + '').toLowerCase();
    const rule = rules.rules[id];
    if (!rule) return `^1Error ^3Rule ^2${id}^3 is not found`;

    if (to) {
      if (as.level < this.admin.$.levels.mod) return this.admin.$.cmdErrors.access;
      const p = this.$players.find(to, as, true);

      this.$players.chat(p, [
        `^2Moderator^3 paid your attention to a ^5rule^3:`,
        '',
        ...rule
      ]);

      return `^3Rule ^5${id}^3 has been sent to ${this.$players.name(p)}`;
    }

    return rule;
  }

  async ['ANY+ rules : List rules of this server'](arg) { return this.rulesCmd(arg); }
  async ['ANY+ rule <#> [<to>]: Show details for rule # (to player <to> or self)'](arg) { return this.rulesCmd(arg); }
}

module.exports = Info;
