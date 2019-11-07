const {Db} = require('clasync');

class Mod extends Db.Mongo.Model {
  get schema() {
    return new this.Schema({
      _id: String,
      alias: String,
      defaults: this.Schema.Types.Mixed,
      modes: this.Schema.Types.Mixed
    }, {
      collection: 'mod'
    })
      .index({alias: 1})
  }

  feedConfig(from, to, what, def) {
    const s = from[what];
    if (!s) return null;
    let d = to[what];
    if (d) return d;
    to[what] = d = {};

    if (s.inherits) {
      for (const k of this.$.objectKeys) d[k] = {};
      for (const k of this.$.arrayKeys) d[k] = [];

      for (const inherit of s.inherits) {
        const h = inherit ? this.feedConfig(from, to, inherit, def) : def;
        if (!h) continue;

        for (const k of this.$.objectKeys) Object.assign(d[k], h[k]);
        for (const k of this.$.arrayKeys) d[k].push(...h[k] || []);

        for (const k of this.$.valueKeys) if (k in h) {
          const sk = h[k];

          if (typeof sk === 'object') d[k] = sk instanceof Array ? [...sk] : {...sk};
          else d[k] = sk;
        }
      }

      for (const k of this.$.objectKeys) Object.assign(d[k], s[k]);
      for (const k of this.$.arrayKeys) d[k].push(...s[k] || []);
    } else {
      for (const k of this.$.objectKeys) d[k] = {...def[k], ...s[k]};
      for (const k of this.$.arrayKeys) d[k] = [...def[k] || [], ...s[k] || []];
    }

    const valueKeys = [...this.$.valueKeys, ...this.$.ownKeys];

    for (const k of valueKeys) if (k in s) {
      const sk = s[k];
      if (typeof sk === 'object') d[k] = sk instanceof Array ? [...sk] : {...sk};
      else d[k] = sk;
    }

    return d;
  }

  async getConfig(aliasSrc) {
    const alias = aliasSrc || this.$.defaultAlias;
    let doc = await this.model.findOne({alias}).lean().exec();

    if (!doc) {
      if (aliasSrc) return null;
      doc = this.db.app.modes;
    }

    const {modes, defaults} = doc;
    const to = {};

    for (const mode in modes) {
      const modeObj = this.feedConfig(modes, to, mode, defaults);      
      if (!modeObj) continue;

      if (!modeObj.maps) {
        const mapsRes = Object.keys(this.$.omits(
          this.$.invert(modeObj.mapsAdd || []),
          this.$.invert(modeObj.mapsDel || [])
        ));

        if (mapsRes.length) modeObj.maps = mapsRes;
      }
    }

    return to;
  }
}

Mod.defaultAlias = 'default';
Mod.valueKeys = ['enabled', 'desc', 'rules'];
Mod.ownKeys = ['maps'];
Mod.objectKeys = ['pre', 'post', 'mod'];
Mod.arrayKeys = ['mapsAdd', 'mapsDel'];

module.exports = Mod;
