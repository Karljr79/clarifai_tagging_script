"use strict";
//load dependencies
var BoxSDK = require('box-node-sdk');
var Clarifai = require('clarifai');
var Bottleneck = require("bottleneck");
var fs = require('fs');
var path = require('path');
var config = require('./config');

//setup Box SDK
let sdk = new BoxSDK({
		clientID: config.Box.clientID,
		clientSecret: config.Box.clientSecret,
		appAuth: {
			keyID: config.Box.publicKeyId,
			privateKey: fs.readFileSync(path.resolve(__dirname, config.Box.privateKeyPath)),
			passphrase: config.Box.privateKeyPassphrase
		}
	});

//setup Clarifai SDK
let clarifaiClient = new Clarifai.App(config.Clarifai.clientID, config.Clarifai.clientSecret);

//rate limiter
var limiter = new Bottleneck(1, 100);

// This Box API client will coorespond to a 'service account'
// To make this work for a user, you would use this:
// userAPIClient = sdk.getAppAuthClient('user', someBoxUserId);
//and then use that client in the script
let adminAPIClient = sdk.getAppAuthClient('enterprise', config.Box.enterpriseId);
let resultsLimit = 500;
let imageArr = [];
let count = 0;

//helper function to extract file extension
function getExtension(filename) {
    let parts = filename.split('.');
    return parts[parts.length - 1];
}

//helper function to verify file is an image supported by Clarifai
function isImage(filename) {
    let ext = getExtension(filename);
    switch (ext.toLowerCase()) {
      case 'jpg':
      case 'gif':
      case 'bmp':
      case 'png':
          return true;
    }
    return false;
}

//helper function to generate query params for Box request
function generateSearchQueryParams(limit, offset) {
    let qs = {'limit':limit,
              'offset': offset};
    return qs;
}

//gets chunk of folder items
function getImages(folderId, limit, offset) {
    return new Promise(function(resolve, reject) {
      adminAPIClient.folders.get(folderId, generateSearchQueryParams(limit, offset), function (err, data) {
        if (err) { reject(err); }
          resolve(data);
        });
    });
}

//looping function to retreive all items in a folder
function getAllImages(folderId, limit) {
    var offset = 0;
    function getMoreImages() {
        return getImages(folderId, limit, offset).then(function(data) {
            offset += limit;
            if (data.item_collection.total_count > offset) {
                return addImagesToArray(data).then(getMoreImages);
            } else {
                return addImagesToArray(data);
            }
        });
    }
    return getMoreImages();        
}

function addImagesToArray(data) {
    return new Promise(function(resolve, reject) {
      data.item_collection.entries.forEach((entry) => {
        //if the file is a supported extension
        if (isImage(entry.name)){
          imageArr.push(entry.id);
        }
      });
      resolve();
    });
}

function getImageDownloadURL(fileId, callback) {
  adminAPIClient.files.getDownloadURL(fileId, null, function (err, data) {
    callback(err, data);
  });
}

//send the Box Download URL to Clarifai for identification.
//Returns a comma-separated 
function sendImageToClarifai(boxURL, callback) {
    let clarifaiTagsArray = [];
    let clarifaiTagsString = "";
    // predict the contents of an image by passing in a url
    clarifaiClient.models.predict(Clarifai.GENERAL_MODEL, boxURL).then(
      function(response) {
        response.data.outputs[0].data.concepts.forEach(function(concept){
          //console.log(concept.name);
          clarifaiTagsArray.push(concept.name);
        });
        clarifaiTagsString = clarifaiTagsArray.join(", ");
        callback(clarifaiTagsString);
      },
      function(err) {
        console.error(err);
      }
    );
}

function setBoxMetadataOnFile(fileId, tags) {
  return new Promise(function(resolve, reject){
    let imageRecognitionAttrName = config.Box.metadataTemplate.imageRecognitionAttrName;
    let tagsAttrName = config.Box.metadataTemplate.tagsAttrName;
    let data = { tagsAttrName: tags,
                 imageRecognitionAttrName: 'Clarifai' }
    adminAPIClient.files.addMetadata(fileId, "enterprise", config.metadataTemplate.templateName, data, function(err, response) {
      if (err) { 
        console.log("Error Setting Metadata: " + err);
        reject(err);
      }
      count++;
      console.log("Successfully Set Metadata on File ID:" + fileId + "   Total Set: " + count);
      resolve(response);
    });
  })
}

//main function
module.exports = function (folderId) {
  getAllImages(folderId, resultsLimit).then(function() {
    console.log(imageArr);
    imageArr.forEach(function(element){
      limiter.submit(getImageDownloadURL,element,function(err, data){
        if (err) { console.log("Error getting URL: " + err); }
        sendImageToClarifai(data, function(data){
          setBoxMetadataOnFile(element, data);
        });
      });
    });
  }, function(err) {
    if (err) { console.log(err); }
  });
}
