const {Db} = require('clasync');

class Users extends Db.Mongo.Model {
  get schema() {
    return new this.Schema({
      _id: String,
      known: [String],
      name: [String],
      auth: [String],
      pwd: String,
      pwdOne: Boolean,
      guid: [String],
      ip: [String],
      ipStat: this.Schema.Types.Mixed, // {[ip]: {nConns, pingSum, last}}
      last: Date,
      lastIp: String,
      bans: [String],
      password: [String],
      discordUserId: String,
      settings: this.Schema.Types.Mixed
    }, {
      collection: 'users'
    })
      .index({known: 1})
      .index({name: 1})
      .index({auth: 1})
      .index({ip: 1})
      .index({discordUserId: 1})
    ;
  }

  getIpQuery(ip) {
    let $in;

    if (ip.charAt(0) === '[') {
      $in = [];
      const parts = ip.split(':');
      let s = '';
      let l = parts.length - 1;

      for (let i = 0; i < l; i++) {
        s += parts[i] + ':';
        $in.unshift(s);
      }

      $in.unshift(ip);
    } else {
      $in = (
        [this.$.rxIp, this.$.rxIpC, this.$.rxIpB, this.$.rxIpA]
        .map(rx => (ip.match(rx) || []) [0])
      );
    }

    return {ip: {$in}, auth: ''};
  }

  getQuery({auth, ip}) {
    if (auth) return {auth};
    return this.getIpQuery(ip);
  }

  async merge({from, to}) {
    const user = await this.model.findOne(
      {_id: from},
      {_id: 0, ipStat: 1, settings: 1, ...this.$.arrayKeys}
    ).lean().exec();

    if (!user) return false;
    const $set = {};
    const ip = user.ipStat;
    for (const k in ip) $set[`ipStat.${k}`] = ip[k];
    delete user.ipStat;
    const s = user.settings;
    for (const k in s) $set[`settings.${k}`] = s[k];
    delete user.settings;
    const updated = await this.model.updateOne({_id: to}, {$addToSet: user, $set: ipSet}).exec();
    const ok = updated.n > 0;
    if (!ok) return false;
    await this.model.remove({_id: from}).exec();
    return true;
  }

  async authPwd(auth, pwd) {
    const user = await this.model.findOne({auth, pwd}, {pwdOnce: 1}).lean().exec();
    if (user && user.pwdOnce) await this.model.updateOne({_id: user._id}, {$unset: {pwd: 1, pwdOnce: 1}}).exec();
    return user;
  }

  async setAuthPwd(auth, pwd, pwdOnce) {
    const user = await this.model.findOneAndUpdate({auth}, {$set: {pwd, pwdOnce}}).lean().exec();
    return user;
  }

  async getAliases(_id) {
    const user = await this.model.findOne({_id}, {name: 1}).lean().exec();
    return user && user.name;
  }

  async getUser(player) {
    const query = this.getQuery(player);
    const name = player.info.name || '';
    const guid = player.guid || '';
    const password = player.info.password || '';
    const auth = player.auth || '';
    const ip = (player.ip || '').toString();
    const ipNorm = ip.replace(this.$.rxNotDigit, '_');
    const now = new Date();

    const pre = await this.model.findOneAndUpdate(
      query,
      {$setOnInsert: {_id: this.db.$.newShortId(), auth: [auth], ip: [ip]}},
      {select: {_id: 1}, new: true, upsert: true}
    ).lean().exec();

    const user = await this.model.findOneAndUpdate({_id: pre._id}, {
      $addToSet: {name, auth, guid, password, ip},
      $inc: {[`ipStat.${ipNorm}.nConns`]: 1, [`ipStat.${ipNorm}.pingSum`]: player.ping | 0},
      $set: {[`ipStat.${ipNorm}.last`]: now, last: now, lastIp: ip}
    }, {new: true, select: {guid: 1, settings: 1}}).lean().exec();

    if (user.guid.length > 100) await this.model.updateOne({_id: old._id}, {$set: {guid: [player.guid]}}).exec();
    delete user.guid;
    player.dbId = user._id;
    Object.assign(player, user.settings);
    return user;
  }

  getTree(obj, to, opts) {
    if (typeof obj !== 'object') return obj;
    const o = opts || {};
    const r = to || {};

    for (const [k, v] of Object.entries(obj)) {
      const [, key, rest] = k.match(this.$.rxDotSplit) || [];
      const isObj = rest || (o.deep && typeof v === 'object');

      if (isObj) {
        this.getTree(
          rest ? {[rest]: v} : v,
          typeof r[key] === 'object' ? r[key] : (r[key] = {}),
          opts
        );
      } else {
        if (o.unset) {
          delete r[key];
        } else {
          r[key] = v;
        }
      }
    }

    return r;
  }

  async update(player, settings, opts) {
    const _id = player.dbId;
    if (!_id) return;
    const unset = opts && opts.unset;
    const keys = this.$.mapKeys(settings, k => `settings.${k}`);
    await this.model.updateOne({_id}, {[unset ? '$unset': '$set']: keys}).exec();
  }
}

Users.arrayKeys = {
  known: 1,
  name: 1,
  auth: 1,
  guid: 1,
  ip: 1,
  bans: 1,
  password: 1
};

Users.rxDotSplit = /^([^\.]*)(?:\.(.*))?$/;
Users.rxIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
Users.rxIpA = /^\d{1,3}\./;
Users.rxIpB = /^\d{1,3}\.\d{1,3}\./;
Users.rxIpC = /^\d{1,3}\.\d{1,3}\.\d{1,3}\./;
Users.rxNotDigit = /[^\d]/g;

module.exports = Users;
