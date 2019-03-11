/*
* Module to handle all the routing

*/
//Dependencies
var handlers = require('./handlers');


//export  router
exports.route = {
  '' : handlers.index,
  'account/create':handlers.accountCreate,
  'account/edit':handlers.accountEdit,
  'account/deleted':handlers.accountDeleted,
  'session/create':handlers.sessionCreate,
  'session/deleted':handlers.sessionDeleted,
  'checks/all':handlers.checkList,
  'checks/create':handlers.checksCreate,
  'checks/edit':handlers.checksEdit,
  'api/users': handlers.users,
  'api/tokens':handlers.tokens,
  'api/checks':handlers.checks,
  'api/notFound' : handlers.notFound
};
