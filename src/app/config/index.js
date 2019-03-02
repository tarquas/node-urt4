let env;

switch (process.env.NODE_ENV) {
  case 'dev':
  case undefined:
    env = {...require('./default'), ...require('./dev')};
    break;

  default:
    throw new Error(`Config "${process.env.NODE_ENV}" not found`);
    break;
}

module.exports = env;
