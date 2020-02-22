const Cmd = require('./cmd');

class Stats extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$hits', '$inv', '$players')
    });
  }
}

module.exports = Stats;
