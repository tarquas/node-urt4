const Cmd = require('./cmd');

class Info extends Cmd {
  async init(sub) {
    await sub({
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
      '^2Tip:^3 Join our TeamSpeak 3: ^5pwnz.pro'
    ]);

    this.$.set(player, '$info', 'tipsShown', true);
  }

  async rulesCmd({as, args: [numArg]}) {
    const mode = await this.urt4.rpc(`com getcvar nodeurt_mode`);
    const modeObj = this.$mod.modes[mode];
    const rules = modeObj.rules;
    const num = numArg | 0;
    if (!num) return rules.desc;
    const rule = rules.rules[num - 1];
    if (!rule) return `^1Error ^3Rule ^2#${num}^3 not found`;
    return rule;
  }

  async ['ANY+ rules : List rules of this server'](arg) { return this.rulesCmd(arg); }
  async ['ANY+ rule <#>: Show details for rule #'](arg) { return this.rulesCmd(arg); }
}

module.exports = Info;
