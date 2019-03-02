const Db = require('clasync/db/mongo');
const Users = require('./users');
const Mod = require('./mod');

class DbHub extends Db {
  async init(sub) {
    await sub({
      $users: Users.sub(),
      $mod: Mod.sub()
    });

    console.log('Connected to database');
  }

  async final() {
    console.log('Disconnected from database');
  }
}

module.exports = DbHub;
