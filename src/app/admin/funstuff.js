const Cmd = require('./cmd');

class Funstuff extends Cmd {
  async init(deps) {
    
  }
}

Funstuff.prefs = {
  funStuff: {type: Boolean, desc: 'Use personalized funstuff'},
  funStuffDrop: {type: Boolean, desc: 'Allow droping funstuff'},
}

module.exports = Funstuff;
