const Cmd = require('./cmd');

class Follow extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.admin, '$qvm', '$pos')
    });

    this.$qvm.on('world', this.onWorld, -1);
    this.$pos.on('ent', this.onEnt, -1);
    this.$pos.on('ps', this.onPs);
  }

  async onWorld$() {
    this.urt4.cmd('sv followreset ');
  }

  async onEnt$({id, cur}) {
    if (!cur) {
      this.urt4.cmd(`sv followfree ${id}`);
      await this.emit('free', {id});
    }
  }

  async onPs$({id, prev, diff}) {
    //if (diff) console.log(id, diff);
  }

  // CMD

}

Follow.stats7 = {
  attackKey: 1,
  dialogShown: 2,
  weaponModeKey: 8, // spec ctrl
  walkKey: 16, // spec ctrl
  reloadKey: 32,
  medicKey: 64, // spec ctrl
  useKey: 128,
  sprintKey: 256, // spec ctrl
  keyPressed: 2048,
};

module.exports = Follow;
