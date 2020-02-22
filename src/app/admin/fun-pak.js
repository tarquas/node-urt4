const Cmd = require('./cmd');

class FunPak extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$players')
    });

    return; // disable

    this.pakName = this.$.pakName;

    this.$qvm.on('begin', this.onBegin.bind(this));
    this.$players.on('user', this.onUser.bind(this));

    //this.sv.on('map', this.onMap.bind(this));
  }

  /*async onMap({map}) {
    const name = this.pakName;

    const [paks, paknames, refpaks, refpaknames] = await this.urt4.rpcs([
      'com getcvar sv_paks',
      'com getcvar sv_pakNames',
      'com getcvar sv_referencedPaks',
      'com getcvar sv_referencedPakNames'
    ]);

    const pakCsums = paks.split(' ');
    const pakNames = paknames.split(' ');
    const pakNameIdx = this.$.invert(pakNames);
    const refPakNames = refpaknames.split(' ');
    const refPakNameIdx = this.$.invert(refPakNames);

    const idx = pakNameIdx[name];

    if (idx in pakCsums && !(`q3ut4/${name}` in refPakNameIdx)) {
      this.urt4.cmds([
        `com cvar 1 sv_referencedPakNames q3ut4/${name} ${refpaknames}`,
        `com cvar 1 sv_referencedPaks ${pakCsums[idx]} ${refpaks}`
      ]);
    }
  }*/

  async onBegin({client}) {
    const player = this.$players.clients[client];
    if (!player) return;
    if (!this.$.get(player, 'funPak', 'loading', this.pakName)) return;
    await this.$players.unset(player, {[`funPak.loading.${this.pakName}`]: 1});
    await this.$players.set(player, {[`funPak.loaded.${this.pakName}`]: 1});
    await this.backToMap(client);
  }

  async onUser({client, player}) {
    if (this.$.get(player, 'funPak', 'loading', this.pakName)) {
      await this.$players.unset(player, {[`funPak.loading.${this.pakName}`]: 1});
      return;
    }

    if (this.$.get(player, 'funPak', 'loaded', this.pakName)) return;
    await this.$players.set(player, {[`funPak.loading.${this.pakName}`]: 1});
    await this.offerPak(client, this.pakName);
  }

  async offerPak(client, map) {
    const [src0, src1, paks, paknames] = await this.urt4.rpcs([
      ...[0, 1].map(cfgId => `sv getcfg ${cfgId}`),
      'com getcvar sv_paks',
      'com getcvar sv_pakNames'
    ]);

    const pakCsums = paks.split(' ');
    const pakNames = paknames.split(' ');
    const pakNameIdx = this.$.invert(pakNames);

    const cfg0 = src0.replace(this.$.rxCfgMapname, `\\mapname\\${map}`);
    const idx = pakNameIdx[map];

    const cfg1 = idx in pakCsums ? (src1
      .replace('\\sv_referencedPakNames\\', `\\sv_referencedPakNames\\q3ut4/${map} `)
      .replace('\\sv_referencedPaks\\', `\\sv_referencedPaks\\${pakCsums[idx]} `)
    ) : src1;

    this.urt4.cmd(`sv gs ${client} 1 ${cfg0}\n${cfg1}`);
  }

  async backToMap(client) {
    const [cfg0, cfg1] = await this.urt4.rpcs([0, 1].map(cfgId => `sv getcfg ${cfgId}`));
    const cmd = `sv gs ${client} 0 ${cfg0}\n${cfg1}`;
    this.urt4.cmd(cmd);
  }

  // CMD

  async ['ADMIN+ dbgfunpak <player> : Clear player fun-pak state']({as, args: [player]}) {
    if (!player) return this.admin.$.cmdErrors.help;
    const p = this.$players.find(player, as);
    await this.$players.set(p, {'funPak.loaded': {}});
    return `^2Done`;
  }
}

FunPak.rxCfgMapname = /\\mapname\\[^\\]*/;

FunPak.pakName = 'ho-ho-ho-party';

module.exports = FunPak;
