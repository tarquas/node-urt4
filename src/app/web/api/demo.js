const {$, Web} = require('clasync');
const fg = require('fast-glob');

class Demo extends Web.Rest {
  async init(deps) {
  }

  static rxGlobOpts = {
    cwd: `${process.cwd()}/q3ut4`,
    deep: 0,
    followSymbolicLinks: false,
    absolute: true,
    onlyFiles: true,
    braceExpansion: false,
    caseSensitiveMatch: true,
    extglob: false,
    globstar: false,
  };

  async ['GET /demo/:server/:datetime/:map/:pfx/:sfx']({params: {server, datetime, map, pfx, sfx}, res}) {
    const [urt4] = $.arrayIter($.filterIter($.values(this.$$.urt4s), urt4 => urt4.serverId === server));
    if (!urt4) throw 'notFound';

    const {demoDir} = urt4;
    const date = datetime.slice(0, 10);

    const found = await fg(`${demoDir}/${date}/${datetime}_${map}/${pfx}*${sfx}.urtdemo`, this.$.rxGlobOpts);
    if (!found.length) throw 'notFound';
    const file = found[0];
    if (!file) throw 'notFound';

    res.attachment(`${datetime}_${map}_${pfx}_${sfx}.urtdemo`).sendFile(file);
    return res;
  }
}

module.exports = Demo;
