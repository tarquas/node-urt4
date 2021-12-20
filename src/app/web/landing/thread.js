const {Thread} = require('clasync');
const config = require('../../config');
const WebHub = require('.');

class WebThread extends Thread {
  static async configure() {
    return config;
  }

  async init(deps) {
    await deps({
      $web: WebHub.new(this.web.landing)
    });
  }
}

module.exports = WebThread;
