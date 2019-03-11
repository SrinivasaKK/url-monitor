/* This is the library for stroing and rotating logString
*/

//Dependencies
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

//container

var lib = {};

//actual path to the log folder (base directory)
lib.baseDir = path.join(__dirname+'/../.logs/');

//appned a string to a file. Create a file if it doesnot exist
lib.append = function(file,str,callback){
  //open file for appending
  fs.open(lib.baseDir+file+'.log','a',function(err,fileDescriptor){
    if(!err && fileDescriptor){
      //append to the file and close it
      fs.appendFile(fileDescriptor,str+'\n', function(err){
        if(!err){
          //close the file
          fs.close(fileDescriptor,function(err){
            if(!err){
              callback(false);
            }
            else{
              callback("Error: Could not close the file");
            }
          });
        }
        else{
          callback("Error appending to the file");
        }
      });
    }else {
      callback('could not open file for appending');
    }
  });
}

//list all the logs and optionally include compressed logs

lib.list = function(includeCompressedLogs,callback){
   fs.readdir(lib.baseDir,function(err,data){
    if(!err && data && data.length>0){

      var trimmedFileNames = [];
      data.forEach(function(fileName){
        //add the .log files
        if(fileName.indexOf('.log')>-1){
          trimmedFileNames.push(fileName.replace('.log',''));
        }

      // add on the .gz to this array
      if(fileName.indexOf('.gz.b64') >-1 && includeCompressedLogs) {
           trimmedFileNames.push(fileName.replace('.gz.b64',''));
      }

      });

      callback(false,trimmedFileNames);

    }
    else {
      callback(err,data);
    }

   });

}

//compress the contents of one .log file into a .gz.b64 file within the same directory

lib.compress = function(logId, newFileId, callback) {

  var sourceFile = logId+'.log';
  var destFile = newFileId + '.gz.b64';

  //read the source file
  fs.readFile(lib.baseDir+sourceFile,'utf8',function(err,inputString){
    if(!err && inputString){
     //compress the string using gzip
     zlib.gzip(inputString,function(err,buffer){
     if(!err && buffer){
      //send the data to the destination file
      fs.open(lib.baseDir+destFile,'wx',function(err,fileDescriptor){
       if(!err && fileDescriptor){
        //write to the file
        fs.writeFile(fileDescriptor,buffer.toString('base64'),function(err){
         if(!err){
            callback(false);

         }else {
           callback(err);
         }

        });

       }else {
         callback(err);
       }

      });

     }else {
       callback(err);
     }

     });

    }else {
      callback(err);
    }


  });

};

//decompress the contets of a .zg.b64 to a string

lib.decompress = function(fileId,callback){
 var fileName = fileId + '.gz.b64';
 //read the file
 fs.readFile(lib.baseDir+fileName,'utf8',function(err,str){
   if(!err && str){
     //decompress the data
     var inputBuffer = Buffer.from(str,'base64');
     zlib.unzip(inputBuffer,function(err,outputBuffer){
        if(!err && outputBuffer){
         var str = outputBuffer.toString();
         callback(false,str);
        }else {
          callback(err);
        }

     });

   }else {
     callback(err);
   }

 });

};

//truncate the log file
lib.truncate = function(logId,callback){

   fs.truncate(lib.baseDir+logId+'.log',0,function(err){

     if(!err){
       callback(false);
     }else {
       callback(err);
     }
   });

}

//export the Module

module.exports = lib;
