/*
* This is the primary file for the API
*
*/
//Dependencies
var server = require('./lib/server');
var workers = require('./lib/workers');

// Declare the app
var app = {};

//Init function
app.init = function(){
  //start the server
  server.init();
  //start the workers
  workers.init();
};

//Execute
app.init();

//Export the modlue
module.exports = app;
