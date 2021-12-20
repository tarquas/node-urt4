const {$, Web} = require('clasync');

const Demo = require('./demo');
const Info = require('./info');

class WebApiHub extends Web.Api {
  async init(deps) {
    await deps({
      $demo: Demo.new(),
      $info: Info.new(),
    });
  }

  async response(data, req) {
    if (data === req.res) return;
    return await super.response(data, req);
  }
}

module.exports = WebApiHub;
