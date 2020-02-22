const {Web} = require('clasync');

class Static extends Web.Rest {
  async ['USE /'](req) {
    await this.express(this.web.$.static(`${__dirname}/../../../../www`), req);
    req.res.status(404);
    return 'Not found';
  }
}

module.exports = Static;
