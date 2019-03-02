const ClasyncEmitter = require('clasync/emitter');

class Qvm extends ClasyncEmitter {
  async init() {
    this.urt4.com.on('out', this.onOut.bind(this));
  }

  async onOut({text}) {
    const [, , authSlot, authLogin, authLevel, authNotor, authAddon] =
      text.match(this.$.rxAuthConfirmed) || [];

    if (authSlot) {
      this.emit('auth', {
        client: authSlot | 0,
        auth: authLogin,
        level: authLevel | 0,
        notor: authNotor,
        addon: authAddon
      });

      return;
    }

    const [, badAuthSlot] = text.match(this.$.rxAuthRejected) || [];
    if (badAuthSlot) { this.emit('badauth', {client: badAuthSlot | 0}); return; }

    const [, clientBegin] = text.match(this.$.rxClientBegin) || [];
    if (clientBegin) { this.emit('begin', {client: clientBegin | 0}); return; }

    const [, clInfo, clInfoStr] = text.match(this.$.rxClientUserinfo) || [];
    if (clInfo) { this.emit('info', {client: clInfo | 0, info: clInfoStr}); return; }

    const [, clInfoCh, clInfoChStr] = text.match(this.$.rxClientUserinfoChanged) || [];
    if (clInfoCh) { this.emit('info2', {client: clInfoCh | 0, info: clInfoChStr}); return; }

    const [, clientSpawn] = text.match(this.$.rxClientSpawn) || [];
    if (clientSpawn) { this.emit('spawn', {client: clientSpawn | 0}); return; }

    const [, clItem, item] = text.match(this.$.rxItemPick) || [];
    if (clItem) { this.emit('item', {client: clItem | 0, item}); return; };
  }
}

Qvm.rxAuthConfirmed = /^auth: user validated - name: (.*) - slot: (\d+) - login: (\w*) - level: ([-\d]+) - notoriety: (.*) - addon:\s*(.*)\n$/;
Qvm.rxAuthRejected = /^AccountKick: (\d+)/;
Qvm.rxClientBegin = /^ClientBegin: (\d+)\n/;
Qvm.rxClientUserinfo = /^ClientUserinfo: (\d+) ([\S\s]*)\n$/;
Qvm.rxClientUserinfoChanged = /^ClientUserinfoChanged: (\d+) ([\S\s]*)\n$/;
Qvm.rxClientSpawn = /^ClientSpawn: (\d+)\n/;
Qvm.rxItemPick = /^Item: (\d+) (\w+)/;

module.exports = Qvm;
