/*
*
* Library for storing and editing data
*/


//Dependencies
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');
//container for the module
var lib = {};

//actual path to the file (base directory)
lib.baseDir = path.join(__dirname+'/../.data/');
//Write data to the file

lib.create = function(dir,file,data,callback){
//open the file for writing
fs.open(lib.baseDir+dir+'/'+file+'.json','wx',function(err,fileDescriptor){
  if(!err&&fileDescriptor){
    //convert data to string
    var stringData = JSON.stringify(data);
    //write data into the file and close
    fs.writeFile(fileDescriptor,stringData,function(err){
      if(!err){
         fs.close(fileDescriptor,function(err){
           if(!err){
        callback(false);
           }else{
             callback('error closing new file');
           }
         });

      }
      else{
        callback('Error writing to new file');
      }
    });
  }
  else{
    callback('Could not create new file, it may already exist');
  }
});


};

//Read data from the file
   lib.read = function(dir,file,callback){
      fs.readFile(lib.baseDir+dir+'/'+file+'.json','utf8',function(err,data){
        if(!err && data){
          var parsedData = helpers.parseJsonToObject(data);
          callback(false,parsedData);

        }
        else{
          callback(err,data);
        }

 });


};

//Update the file

lib.update = function(dir,file,data,callback){

//open the file
fs.open(lib.baseDir+dir+'/'+file+'.json','r+',function(err,fileDescriptor){

  if(!err && fileDescriptor){
    //convert data to string
    var stringData = JSON.stringify(data);
    //truncate the old contents of the file
    fs.truncate(fileDescriptor,function(err){
      if(!err){
        //write to the file and close it
        fs.writeFile(fileDescriptor,stringData,function(err){
          if(!err){
            //close the file
            fs.close(fileDescriptor,function(err){
              if(!err){
                 callback(false);
              }
              else {
                  callback('error closing new file');
                }

            });
          }
          else{
              callback('error updating the file');
          }
        });

      }
      else{
        callback('error truncating the file');
      }
    });

  }
  else{
    callback('Could not open the file for updating, file may not exist yet');
  }

});


};

//delete the file

lib.delete = function(dir,file,callback){
  //unlink the file
  fs.unlink(lib.baseDir+dir+'/'+file+'.json',function(err){
    if(!err){
      callback(false);
    }else{
      callback('error deleting the file');
    }

  })

};
//list all the files in the directory
lib.list = function(dir,callback){
fs.readdir(lib.baseDir + dir +'/',function(err,data){
  if(!err && data && data.length > 0){
    var trimmedFileNames = [];
    data.forEach(function(fileName){
      trimmedFileNames.push(fileName.replace('.json',''));
    });
    callback(false,trimmedFileNames);
  }
  else{
    callback(err,data);
  }

});

};
//Export the Library

module.exports = lib;
