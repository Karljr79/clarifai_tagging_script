'use strict';
const clarifaiTagger = require('./clarifai_tagger.js');
const config = require('./config');

clarifaiTagger(config.Box.photosFolder);

