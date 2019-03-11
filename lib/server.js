/*
* This file contains server related tasks
*
*/
//Dependencies
var http = require("http");
var https = require("https");
var url = require("url");
var StringDecoder = require("string_decoder").StringDecoder;
var config = require('./config');
var fs = require('fs');
var router = require('./router');
var handlers = require('./handlers');
var helpers = require('./helpers');
var path = require('path');
var util = require('util');
var debug = util.debuglog('server');

/* this is to send an sms using twilo
// @todo Get rid of this later
// helpers.sendTwilioSms('4158375309','Hello',function(err){
//   console.log(err);
// });
*/

//Instantiate the server object

var server = {};

//Instantiate HTTP server
server.httpServer = http.createServer((req, res) => {

  server.unifiedServer(req, res);

});

// Key and certificate generated from openssl are needed to start https server
server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}

//Instantiate HTTPS server
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {

  server.unifiedServer(req, res);

});
//Unified server logic to handle both http and https

server.unifiedServer = (req, res) => {
  var ParsedURL = url.parse(req.url, true);
  //Get the Path
  var Path = ParsedURL.pathname;
  //to remove the "/" in the URL
  var TrimmedPath = Path.replace(/^\/+|\/+$/g, "");

  //Get the http method used
  var method = req.method.toLowerCase();
  //Get the queryString objects if any (like https://abcd.cm?id=1)

  var queryStringObject = ParsedURL.query;
  //Get Headers
  var headers = req.headers;
  //Get Payload if any
  var decoder = new StringDecoder('utf-8');
  var buffer = ''
  req.on('data', (data) => {

    buffer += decoder.write(data);

  });

  req.on('end', function () {
    buffer += decoder.end();



    //choosing the handler here. If not found, go to not found handler
    var chosenHandler = typeof (router.route[TrimmedPath]) !== 'undefined' ? router.route[TrimmedPath] : router.route[''];
    
    var data = {
      'TrimmedPath': TrimmedPath,
      'method': method,
      'queryStringObject': queryStringObject,
      'headers': headers,
      'payload': helpers.parseJsonToObject(buffer)
    };

    chosenHandler(data, function (statusCode, payload, contentType) {

      //Determine the content type of response, (default to JSON)
      contentType = typeof (contentType) == 'string' ? contentType : 'json';

      //use the statuscode sent by callback handler or use defualt one
      statusCode = typeof (statusCode) == 'number' ? statusCode : 200;
      //use the statuscode sent by callback handler or use defualt one

      var payloadString = '';
      //return response- parts that are content specific
      if (contentType == 'json') {
        res.setHeader('Content-Type', 'application/json');
        payload = typeof (payload) == 'object' ? payload : {};
        //convert payload to string
        payloadString = JSON.stringify(payload);
      }

      if (contentType == 'html') {
        res.setHeader('Content-Type', 'text/html');
        payloadString = typeof (payload) == 'string' ? payload : '';

      }
      //return response-parts that are common to all content-types
      res.writeHead(statusCode);
      res.end(payloadString);

      //console.log(statuscode,payloadString);
      if (statusCode == 200) {
        debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + ' /' + TrimmedPath + ' ' + statusCode);
      } else {
        debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + ' /' + TrimmedPath + ' ' + statusCode);
      }
    });

  });
};

//Init function
server.init = function () {
  //start the HTTP server
  server.httpServer.listen(config.httpPort, function () {
    //console.log("HTTP server listening on port: "+config.httpPort);
    console.log('\x1b[36m%s\x1b[0m', 'The HTTP server is running on port ' + config.httpPort);
  });
  //Start the HTTPs server
  server.httpsServer.listen(config.httpsPort, function () {
    // console.log("HTTP server listening on port: "+config.httpsPort);
    console.log('\x1b[35m%s\x1b[0m', 'The HTTPS server is running on port ' + config.httpsPort);


  });
};
//Export the server
module.exports = server;
