const {Db} = require('clasync');

const Users = require('./users');
const Mod = require('./mod');

class DbHub extends Db.Mongo {
  async init(deps) {
    await deps({
      $users: Users.new(),
      $mod: Mod.new()
    });

    console.log('Connected to database');
  }

  async final() {
    console.log('Disconnected from database');
  }
}

module.exports = DbHub;
