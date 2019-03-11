/*
* This file contains worker related tasks

*/

//Dependencies

var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var url = require('url');
var helpers = require('./helpers');
var _logs = require('./logs');

//Instantiate worker object
var workers = {};

//Look up all the checks, get their data, send to validator
workers.gatherAllChecks = function(){
//list all the checks
_data.list('checks',function(err,checks){
  if(!err && checks && checks.length > 0){
   checks.forEach(function(check){
     //Read in the check data
     _data.read('checks',check,function(err,originalCheckData){
        if(!err && originalCheckData){
           //Pass it to the validator and let that function continue or log Errors
           workers.validateCheckData(originalCheckData);
        }
        else{
          console.log("Error reading one of the checks data");
        }

     });
   });

  }
  else{
    console.log("Error: Could not find any checks");
  }

});
};

//Sanity- check the check data
workers.validateCheckData = function(originalCheckData){
 // check if all the keys exist
   originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
   originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
   originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
   originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https','http'].indexOf(originalCheckData.protocol)>-1?originalCheckData.protocol:false;
   originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length>0?originalCheckData.url:false;
   originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['get','put','post','delete'].indexOf(originalCheckData.method)>-1?originalCheckData.method:false;
   originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object'&& originalCheckData.successCodes instanceof Array &&originalCheckData.successCodes.length>0?originalCheckData.successCodes:false;
   originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds)=='number'&& originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds>=1&&originalCheckData.timeoutSeconds<=5?originalCheckData.timeoutSeconds:false;

  //Set the keys that may not be set (workers have never seen this check before)
  originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state)>-1?originalCheckData.state:'down';
  originalCheckData.lastChecked = typeof(originalCheckData.timeoutSeconds)=='number'&& originalCheckData.lastChecked > 0 ?originalCheckData.lastChecked:false;

 // If all the checks pass, pass the data along to next step in the process
 if(originalCheckData.id&&originalCheckData.userPhone&&originalCheckData.protocol&&originalCheckData.url&&originalCheckData.method&&originalCheckData.successCodes&&originalCheckData.timeoutSeconds){

     workers.performCheck(originalCheckData);

 }
 else{
   console.log("Error: One of the checks may not be properly formatted");
 }
};

//Perfrom the cheks, send the original checkdata and the outcome to next process
workers.performCheck=function(originalCheckData){
//prepare the initial check outcome
var checkOutcome = {
  'Error':false,
  'responseCode':false
};

//Mark that outcome has not been sent yet
var outComeSent  = false;

  var parsedUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url,true);
  var hostName = parsedUrl.hostname;
  var path = parsedUrl.path; //we used path and not "pathname" because we want the full querystring that they entered there

//construct the request
var requestDetails = {
  'protocol':originalCheckData.protocol + ':',
  'hostname':hostName,
  'method':originalCheckData.method.toUpperCase(),
  'path':path,
  'timeout':originalCheckData.timeoutSeconds * 1000
};

//Instantiate the request object (using either http or https)
var _moduleToUse = originalCheckData.protocol == 'http'? http : https;

var req = _moduleToUse.request(requestDetails,function(res){
 //Grab the status
 var status = res.statusCode;
 //update the check outcome and pass the data along
  checkOutcome.responseCode = status;
  if(!outComeSent){
    workers.processCheckOutcome(originalCheckData,checkOutcome);
    outComeSent = true;
  }

});

//Bind the error event so that it does not get throw
req.on('error',function(e){
  //update the check outcome and pass data along
  checkOutcome.error = {
    'error':true,
    'value':e
  };
  if(!outComeSent){
    workers.processCheckOutcome(originalCheckData,checkOutcome);
    outComeSent = true;
  }
});

//Bind to the timeout
req.on('timeout',function(e){
  //update the check outcome and pass data along
  checkOutcome.error = {
    'error':true,
    'value':'timeout'
  };
  if(!outComeSent){
    workers.processCheckOutcome(originalCheckData,checkOutcome);
    outComeSent = true;
  }
});

//End the request
req.end();

};

//process the check outcome and update the check data as needed, trigger an alert if needed
//Special logic for accomodating a check that has never been tested before (don't want to alert the user)
workers.processCheckOutcome = function(originalCheckData,checkOutcome){
var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode)>-1?'up':'down';

//Decide if alert is wanted
var alertWanted = originalCheckData.lastChecked && originalCheckData.state !== state?true:false;
//time of check
var timeOfCheck = Date.now();
// update the check data
var newCheckData = originalCheckData;
newCheckData.state = state;
newCheckData.lastChecked = timeOfCheck;
//log the outcome
workers.log(originalCheckData,checkOutcome,state,alertWanted,timeOfCheck);
//save the details
_data.update('checks',newCheckData.id, newCheckData, function(err){
  if(!err){

    //send the  check data to the next phase
    if(alertWanted){
      workers.alertUserToStatusChange(newCheckData);
    }
    else{
      console.log("Check outcome has not changed. So no alert is needed");
    }

  }
  else{
    console.log("Error trying to save updates");
  }
});


};

//Alert the user via sms

workers.alertUserToStatusChange = function(newCheckData){
 var msg = 'Alert: Your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol +'://'+ newCheckData.url +' is currently '+newCheckData.state;
 helpers.sendTwilioSms(newCheckData.userPhone,msg,function(err){
   if(!err){
     console.log("Success: user alerted to status change via sms: ", msg);
   }else{
      console.log("Error: could not alert user to status change");
   }
 })

};

//
workers.log = function(originalCheckData,checkOutcome,state,alertWanted,timeOfCheck){
  //form the log data
 var logData = {
    'check':originalCheckData,
    'outcome':checkOutcome,
    'state':state,
    'alert':alertWanted,
    'time':timeOfCheck
 }

 var logString = JSON.stringify(logData);

 //Determine what to call the log file
 var logFileName = originalCheckData.id;
 //Append the log strings to the file

 _logs.append(logFileName,logString,function(err){
   if(!err){
     console.log("Logging to the file succeeded");
   }else{
     console.log("Logging to the file failed");

   }

 });

};
//Timer to execute worker process once per minute
workers.loop = function(){

 setInterval(function(){
   workers.gatherAllChecks();
 },1000*60);

};

//compress the log files
workers.rotateLogs = function(){
//list all the non compressed log files
_logs.list(false,function(err, logs){
  if(!err && logs && logs.length>0){
      logs.forEach(function(logName){
       //compress data to a different file
       var logId = logName.replace('.log','');
       var newFileId = logId+'-'+Date.now();
       _logs.compress(logId,newFileId,function(err){
         if(!err){
             //truncate the log
             _logs.truncate(logId,function(err){
               if(!err){
                 console.log("success truncating the log files");
               }else {
                  console.log("Error truncating the log files");
               }

             });

         }else {
           console.log("Error: Compressing one of the log files",err);
         }
       })


      });

  }else {
    console.log("Error:could not find any logs to rotate");
  }


})


};

//Timer to execute compress logs process once per day
workers.logRotationLoop = function(){

 setInterval(function(){
   workers.rotateLogs();
 },1000*60*60*24);

};

//Init function
workers.init = function(){
  //Execute all the checks immediately
 workers.gatherAllChecks();

  //call the loop so that checks will Execute later on
  workers.loop();

  //compress all the logs immediately
  workers.rotateLogs();

  //call the compression loop so that the logs will be compressed later on
  workers.logRotationLoop();

}




//Export workers

module.exports = workers;
