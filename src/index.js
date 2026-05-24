// Public API
module.exports = {
  repair: require('./repair/repair-orchestrator'),
  shapeFixes: require('./repair/shape-fixes'),
  autolinkFix: require('./repair/autolink-fix'),
  relationalFix: require('./repair/relational-fix'),
};
