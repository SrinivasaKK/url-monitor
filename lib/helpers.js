/*

*This file is helper for various tasks

*/
//Dependencies

var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var querystring = require('querystring');
//container for helpers
var helpers = {};

//use Sha256 to hash the password
helpers.hash = function(str){

  if(typeof(str)=='string'&&str.length>0){

  var hash = crypto.createHmac('sha256',config.hashingSecret).update(str).digest('hex');
  return hash;

  }
  else {
    return false;
  }

}

//Parse a JSON string to object in all cases without throwing

helpers.parseJsonToObject = (str) => {
try{
  let obj = JSON.parse(str);
       return obj;
    }
catch(e){
      return{};
  }
};

//Random sring generator
helpers.createRandomnString = function(number){

  if(typeof(number) =='number'&& number> 0){
    //Define all possible characters to generate tokens
    var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    //create empty string to store
    var tokenGenerated = '';
    for(i=0;i<number;i++){

     var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
       tokenGenerated += randomCharacter;

    }
    return tokenGenerated;
  }
  else{
    return false;
  }

};
//Send an sms via twilio
helpers.sendTwilioSms = function(phone,msg,callback){
  //validate parameters
  phone = typeof(phone) == 'string' && phone.trim().length == 10?phone.trim():false;
  msg = typeof(msg) == 'string'&& msg.trim().length > 0 && msg.trim().length <=160?msg.trim():false;

  if(phone&&msg){
    //configure twilio payload
    var payload = {
     'From':config.twilo.fromPhone,
     'To':'+1'+phone,
     'Body':msg
   };
   //configure the request details
   var stringPayload = querystring.stringify(payload);

   var requestDetails = {
     'protocol':'https:',
     'hostname':'api.twilio.com',
     'method':'POST',
     'path':'/2010-04-01/Accounts/'+config.twilo.accountSid+'/Messages.json',
     'auth':config.twilo.accountSid+':'+config.twilo.authToken,
     'headers': {
       'Content-Type':'application/x-www-form-urlencoded',
       'Content-Length':Buffer.byteLength(stringPayload)
     }

   };
//Instantiate request
 var req = https.request(requestDetails,function(res){
   //grab the status
   var status = res.statusCode;
   //callback successfuulu if request went through
   if(status ==200 || status == 201){
     callback(false);
   }
   else{
     callback('status code returned'+ status);
   }
 });
      //Bind the error event so that it doesn't get thrown
      req.on('error',function(e){
        callback(e);
      });
      //Add the payload
      req.write(stringPayload);

      //End the request
      req.end();

  } else {
    callback('Given parameters are missing or invalid');
  }


};





//export
module.exports = helpers;
