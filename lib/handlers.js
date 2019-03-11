
/*
*  module to handle all requests in one place
*/

//Dependencies

var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');
//Define handlers
var handlers = {};
/* HTML API handlers
*
*/
//Index handler
handlers.index = function(data,callback){
  callback(undefined,undefined,'html');
};


/* JSON API handlers
*
*/
//Users handler
handlers.users = function(data,callback){
  //acceptable methods
  var acceptableMethods= ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1 ){
   handlers._users[data.method](data,callback);
  }
  else{
    callback(405);
  }

};

//container for user sub methods
handlers._users = {};

//Users - post
//Required fields: Firstname, lastname, phone, password, tosAgreement
//optional data : None
handlers._users.post = function(data,callback){
  // Check that all required fields are filled out
  var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if(firstName && lastName && phone && password && tosAgreement){
    // Make sure the user doesnt already exist
    _data.read('users',phone,function(err,data){
      if(err){
        // Hash the password
        var hashedPassword = helpers.hash(password);

        // Create the user object
        if(hashedPassword){
          var userObject = {
            'firstName' : firstName,
            'lastName' : lastName,
            'phone' : phone,
            'hashedPassword' : hashedPassword,
            'tosAgreement' : true
          };

          // Store the user
          _data.create('users',phone,userObject,function(err){
            if(!err){
              callback(200);
            } else {
              console.log(err);
              callback(500,{'Error' : 'Could not create the new user'});
            }
          });
        } else {
          callback(500,{'Error' : 'Could not hash the user\'s password.'});
        }

      } else {
        // User alread exists
        callback(400,{'Error' : 'A user with that phone number already exists'});
      }
    });

  } else {
    callback(400,{'Error' : 'Missing required fields'});
  }

};


//Users - get
//Required data : phone
//optional data: None

handlers._users.get = function(dataFromQueryString,callback){
  //check if the phone number is valid
  var phone = typeof(dataFromQueryString.queryStringObject.phone)=='string' && dataFromQueryString.queryStringObject.phone.trim().length == 10?dataFromQueryString.queryStringObject.phone.trim():false;
  if(phone){
    //Get the token from Headers
    var token = typeof(dataFromQueryString.headers.token)=='string'?dataFromQueryString.headers.token:false;
    //verify the token came from header is valid for phone number
    handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
      if(tokenIsValid){
        //Look up the user
        _data.read('users',phone,function(err,dataFromFile) {
             if(!err && dataFromFile){
               //remove the hashed password from the user object before retruning it
               delete dataFromFile.hashedPassword;
               callback(200,dataFromFile);
             }
             else{
               callback(404);
             }
        });
      }
      else{
        callback(403,{'Error':'Missing required token in header or token is invalid'});
      }

    });

  }
  else{
    callback(400,{'Error':'Missing required field'});
  }

};
//Users - put
//required data:phone
//optional data: firstName,lastName,password(at least one must be specified)
handlers._users.put = function(data,callback){
//check for phone number
var phone = typeof(data.payload.phone)=='string' && data.payload.phone.trim().length == 10?data.payload.phone.trim():false;
//check for optional fields
var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
if(phone){
  if(firstName||lastName||password){

    //Get the token from Headers
    var token = typeof(dataFromQueryString.headers.token)=='string'?dataFromQueryString.headers.token:false;

    //verify the token came from header is valid for phone number
    handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
      if(tokenIsValid){
        _data.read('users',phone,function(err,userData){
          if(!err && userData){
            //update the necessary fields
                 if(firstName){userData.firstName = firstName}
                 if(lastName){userData.lastName = lastName}
                 if(password){userData.hashedPassword = helpers.hash(password)}

            _data.update('users',phone,userData,function(err){
              if(!err){
               callback(200);
              } else{
                console.log(err);
                callback(500,{'Error':'Could not update the user'});
              }


            });
      }
      else{
          callback(403,{'Error':'Missing required token in header or token is invalid'});
      }
    });
    //Lookup the user


      }
      else{
        callback(400,{'Error':'The specified user doesnt exist'});
      }
    });

  }
  else{
    callback(400,{'Error':'Missing fields to update'});
  }
}
else{
  callback(400,{'Error':'Missing required fields'});
}

};
//Users - delete
//Required : phone

//@TODO clean up (delete) any other data associated with the user -  Done

handlers._users.delete = function(dataFromQueryString,callback){
//check if the phone number is valid
var phone = typeof(dataFromQueryString.queryStringObject.phone)=='string' && dataFromQueryString.queryStringObject.phone.trim().length == 10?dataFromQueryString.queryStringObject.phone.trim():false;
if(phone){
  //Get the token from Headers
  var token = typeof(dataFromQueryString.headers.token)=='string'?dataFromQueryString.headers.token:false;

  //verify the token came from header is valid for phone number
  handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
    if(tokenIsValid){
      //Look up the user
      _data.read('users',phone,function(err,userData) {
           if(!err && userData){
             //delete the user data
             _data.delete('users',phone,function(err){
               if(!err){
               //delete all the data releated to this user as well
               var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
               var checksToDelete = userChecks.length;
               if(checksToDelete>0){
                 //loop through all the checks
                 var checksDeleted = 0;
                 var deletionErrors = false;

                 userChecks.forEach(function(checkId){
                   //Delete check
                   _data.delete('checks',checkId,function(err){
                     if(err){
                       deletionErrors = true;
                     }
                     checksDeleted++;
                     if(checksDeleted == checksToDelete){
                       if(!deletionErrors){
                         callback(200);
                       }
                       else{
                         callback(500,{'Error':'Errors encountered while attempting to delete.'})
                       }
                     }

                   });
                 });


               }else {
                 callback(200);
               }


               }
               else{
                 console.log(err);
                 callback(500,{'Error':'Could not delete the user'});
               }

             });
    }
    else{
        callback(403,{'Error':'Missing required token in header or token is invalid'});
    }
  });

        }
        else{
          callback(400,{'Error':'Could not find specified user'});
        }
   });
}
else{
  callback(400,{'Error':'Missing required field'});
}
};
//tokens handler
handlers.tokens = function(data,callback){
  //acceptable methods
  var acceptableMethods= ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1 ){
   handlers._tokens[data.method](data,callback);
  }
  else{
    callback(405);
  }

};
//tokens Container
handlers._tokens = {};

//tokens - post
//Required field: phone and password
//optional fields : none
handlers._tokens.post = function(data,callback){
  // Check that all required fields are filled out
  var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  if(phone && password){
    //Lookup if user already exists
    _data.read('users',phone,function(err,userData){
          if(!err && userData){
           //check the password sent against the stored hashed passowrd
           //hash the send password first and compare the same with user data
          var hashedPassword = helpers.hash(password);
          if(hashedPassword == userData.hashedPassword){
              //create new token and set expiration data 1 hour from now
              var tokenId = helpers.createRandomnString(20);
              var expires = Date.now() + 1000 * 60 * 60;
              var tokenObject = {
                'phone':phone,
                 'id':tokenId,
                 'expires':expires
              };
             //store the token
             _data.create('tokens',tokenId,tokenObject,function(err){
               if(!err){
                 callback(200,tokenObject);
               }else {
                 callback(500,{'Error':'Could not create the token'});
               }
             });
          }
          else{
            callback(400,{'Error':'Password did not match the specified user\'stored password'});
          }
          }
          else{
            callback(400,{'Error':'Could not find the specified user'});
          }

    })


  }
  else{
    callback(400,{'Error':'Required fields are missing'});
  }
};

//tokens - get
//Required data : id
//optional data:None
handlers._tokens.get = function(dataFromQueryString,callback){
  //check if the phone number is valid
  var id = typeof(dataFromQueryString.queryStringObject.id)=='string' && dataFromQueryString.queryStringObject.id.trim().length == 20?dataFromQueryString.queryStringObject.id.trim():false;
  if(id){
     //Look up the user
     _data.read('tokens',id,function(err,dataFromFile) {
          if(!err && dataFromFile){

            callback(200,dataFromFile);
          }
          else{
            callback(404);
          }
     });
  }
  else{
    callback(400,{'Error':'Missing required field'});
  }

  };
//tokens - put
//required field: id, extend=true
//optional fields:none
handlers._tokens.put = function(data,callback){
//see if id exists
var id = typeof(data.payload.id)=='string' && data.payload.id.trim().length == 20?data.payload.id.trim():false;
var extend = typeof(data.payload.extend)=='boolean' && data.payload.extend == true?true:false;
if(id && extend){
 //look up the token
 _data.read('tokens',id,function(err,tokenData) {
   if(!err&&tokenData){
    //check if the token is expired
    if(tokenData.expires > Date.now()){
        tokenData.expires = Date.now() + 1000*60*60;
        //update the data
        _data.update('tokens',id,tokenData,function(err){
             if(!err){
               callback(200);
             } else {
               callback(500,{'Error':'Could not update the'});
             }

        });


    }else{
      callback(400,{'Error':'Token already expired! Cant extend'})
    }
   }
   else{
     callback(404,{'Error':'Could not find specified token'});
   }

 });

}
else{
  callback(404,{'Error':'Missing required fields'});
}

};

//tokens - delete
//required field:id
//optional fields:none
handlers._tokens.delete = function(dataFromQueryString,callback){
  //check if the id  is valid
  var id = typeof(dataFromQueryString.queryStringObject.id)=='string' && dataFromQueryString.queryStringObject.id.trim().length == 20?dataFromQueryString.queryStringObject.id.trim():false;
  if(id){
     //Look up the token
     _data.read('tokens',id,function(err,dataFromFile) {
          if(!err && dataFromFile){

          _data.delete('tokens',id,function(err){

              if(!err){
              callback(200);
              }
              else{
                console.log(err);
                callback(500,{'Error':'Could not delete the token'});
              }

            });
          }
          else{
            callback(400,{'Error':'Could not find specified token'});
          }
     });
  }
  else{
    callback(400,{'Error':'Missing required field'});
  }
  };

//  Verify if a given token Id is for a given user
handlers._tokens.verifyToken = function(id,phone,callback){
  //look up the token
  _data.read('tokens',id,function(err,tokenData){

    if(!err && tokenData){
    //check the token is for the given phone number and also check if the token is still active
    if(tokenData.phone == phone && tokenData.expires > Date.now()){
      callback(true);
    }
    else{
      callback(false);
    }

    }else{
      callback(false);
    }
  })



}

//Checks
handlers.checks = function(data,callback){
  //acceptable methods
  var acceptableMethods= ['post','get','put','delete'];
  if(acceptableMethods.indexOf(data.method) > -1 ){
   handlers._checks[data.method](data,callback);
  }
  else{
    callback(405);
  }

};

//container for checks sub methods
handlers._checks = {};

//Checks post
//Required fields: Protocol, URL, Methods, successCodes, timeoutSeconds
//  optional fields : none
handlers._checks.post = function(data,callback) {
  //Validate inputs
  var protocol = typeof(data.payload.protocol) == 'string' &&['http','https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol: false;
  var url =  typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim(): false;
  var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method: false;
  var successCodes = typeof(data.payload.successCodes) == 'object'&& data.payload.successCodes instanceof Array &&data.payload.successCodes.length>0?data.payload.successCodes:false;
  // timeoutSeconds must be a number and whole number
  var timeoutSeconds = typeof(data.payload.timeoutSeconds)=='number'&& data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds>=1&&data.payload.timeoutSeconds<=5?data.payload.timeoutSeconds:false;

  if(protocol && url && successCodes && successCodes){
    //Validate the token from the headers
    var token = typeof(data.headers.token) == 'string'?data.headers.token:false;
    if(token){
      //Look up the user by using the token
      _data.read('tokens',token,function(err,tokenData){
        if(!err && tokenData){
          //Get user phone number
          var userPhone = tokenData.phone;
          //Look up the user from User directory
          _data.read('users',userPhone,function(err,userData){
          if(!err && userData){
           //see if there are any checks, if not create a checks array
           var userChecks = typeof(userData.checks) == 'object'&& userData.checks instanceof Array? userData.checks:[];
           //verify the user has less than maximum number of allowed Checks per user
           if(userChecks.length < config.maxChecks){
            //create a new check
            // create randomn Id for ckecks
            var checkId = helpers.createRandomnString(20);
            //Now Create check object and include user's phone as well (cos that's the basis of user indentification)

            var checkObject = {
              'id':checkId,
              'protocol':protocol,
              'url':url,
              'method':method,
              'successCodes':successCodes,
              'timeoutSeconds':timeoutSeconds,
              'userPhone':userPhone
            }
            // create the file and save
            _data.create('checks',checkId,checkObject,function(err){
              if(!err){
                //add the check IDs to user data
                userData.checks = userChecks;
                userData.checks.push(checkId);
                //update the checkIds  user's file
                _data.update('users',userPhone,userData,function(err){
                  if(!err){
                    //send users the checkObject
                         callback(200,checkObject);
                  }
                  else {
                    callback(500,{'Error':'Could not update the user with new check'});
                  }

                });

              }
              else{
                callback(500,{'Error':'Could not create the new check'});
              }

            });
           }
           else{
             callback(400,{'Error':'User already has the maximum number of checks ('+config.maxChecks+')'});
           }

          }
          else{
            callback(403);
          }


          });
        }
        else{
           callback(403,{'Error':'Token is not valid'});
        }


      });

    }
    else{
      callback(400);
    }



  }
  else{
    callback(400,{'Error':'Missing required fields or invalid inputs'});
  }
}

//Checks - get
//required data - id;
//optional data : None
handlers._checks.get = function(data,callback){
  // Check that id is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    // Lookup the check
    _data.read('checks',id,function(err,checkData){
      if(!err && checkData){
        // Get the token that sent the request
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid and belongs to the user who created the check
        console.log("This is check data",checkData);
        handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
          if(tokenIsValid){
            // Return check data
            callback(200,checkData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(404);
      }
    });
  } else {
    callback(400,{'Error' : 'Missing required field, or field invalid'})
  }
};
//Checks put
//required field:id
//optional fields: Protocol, URL, Methods, successCodes, timeoutSeconds// either one of them

handlers._checks.put = function(data,callback){
// Check for required field
  var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  // Check for optional fields
  var protocol = typeof(data.payload.protocol) == 'string' &&['http','https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol: false;
  var url =  typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim(): false;
  var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method: false;
  var successCodes = typeof(data.payload.successCodes) == 'object'&& data.payload.successCodes instanceof Array &&data.payload.successCodes.length>0?data.payload.successCodes:false;
  // timeoutSeconds must be a number and whole number
  var timeoutSeconds = typeof(data.payload.timeoutSeconds)=='number'&& data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds>=1&&data.payload.timeoutSeconds<=5?data.payload.timeoutSeconds:false;
// Error if id is invalid
 if(id){
  if(protocol || url || method || successCodes || timeoutSeconds){
     //read the data from checks for the id
     _data.read('checks',id,function(err,checkData){
       if(!err && checkData){
         //Get the token from Headers
         var token = typeof(data.headers.token)=='string'?data.headers.token:false;
         //verify the token came from header is valid for phone number
         handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
           if(tokenIsValid){
                 //update the necessary fields
                 if(protocol){
             checkData.protocol = protocol;
           }
           if(url){
             checkData.url = url;
           }
           if(method){
             checkData.method = method;
           }
           if(successCodes){
             checkData.successCodes = successCodes;
           }
           if(timeoutSeconds){
             checkData.timeoutSeconds = timeoutSeconds;
           }

                 _data.update('checks',id,checkData,function(err){
                   if(!err){
                    callback(200,checkData);
                   } else{
                     console.log(err);
                     callback(500,{'Error':'Could not update the check'});
                   }
                 });
       }
       else {
            callback(403);
       }

     });
      }
      else{
          callback(403,{'Error':'Check Id doesnot exist'});
      }
    });

  }
  else{
    callback(400,{'Error':'Missing fields to update'});
  }
}
else{
  callback(400,{'Error':'Missing required fields'});
}

};

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function(data,callback){
  // Check that id is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    // Lookup the check
    _data.read('checks',id,function(err,checkData){
      if(!err && checkData){
        // Get the token that sent the request
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
          if(tokenIsValid){

            // Delete the check data
            _data.delete('checks',id,function(err){
              if(!err){
                // Lookup the user's object to get all their checks
                _data.read('users',checkData.userPhone,function(err,userData){
                  if(!err){
                    var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                    // Remove the deleted check from their list of checks
                    var checkPosition = userChecks.indexOf(id);
                    if(checkPosition > -1){
                      userChecks.splice(checkPosition,1);
                      // Re-save the user's data
                      userData.checks = userChecks;
                      _data.update('users',checkData.userPhone,userData,function(err){
                        if(!err){
                          callback(200);
                        } else {
                          callback(500,{'Error' : 'Could not update the user.'});
                        }
                      });
                    } else {
                      callback(500,{"Error" : "Could not find the check on the user's object, so could not remove it."});
                    }
                  } else {
                    callback(500,{"Error" : "Could not find the user who created the check, so could not remove the check from the list of checks on their user object."});
                  }
                });
              } else {
                callback(500,{"Error" : "Could not delete the check data."})
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400,{"Error" : "The check ID specified could not be found"});
      }
    });
  } else {
    callback(400,{"Error" : "Missing valid id"});
  }
};

module.exports =  handlers;
