module.exports = {
  port: process.env.NODEURT_PORT || 8888,
  db: {connString: 'mongodb://127.0.0.1:27017/dev-nodeurt-mod'},
  modes: require('./modes'),
  verb: process.env.VERB
};
