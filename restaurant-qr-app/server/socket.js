const socketConfig = require('./config/socket');

module.exports = {
  init: (server) => socketConfig.initializeSocket(server),
  getIO: () => socketConfig.getIO()
};
