module.exports = {
  port: process.env.NODEURT_PORT || 8888,
  db: {connString: 'mongodb://127.0.0.1:27017/dev-nodeurt-mod'},
  ip: {accessKey: '37d10b37059554b6a20e2430b26640c2'},
  modes: require('./modes'),
  verb: process.env.VERB,
  rules: require('./rules')
};
