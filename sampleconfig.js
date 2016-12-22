module.exports = {
  Box: {
    clientID: 'Your Box Client Id',
    clientSecret: 'Your Box Client Secret',
    publicKeyId: 'Your Box Public Key Id',
    privateKeyPath: './private_key.pem',
    privateKeyPassphrase: 'Your Private Key Passphrase',
    enterpriseId: 'Your Box Enterprise Id',
    photosFolder: 'The folder ID of your photos folder',
    metadataTemplate: {
        templateName: 'Your Metadata Template Name',
        tagsAttrName: 'Your metadata tags attribute name',
        recognitionVersionAttrName: 'Your metadata image rec version attribute name'
    }
  },
  Clarifai: {
    clientID: 'Your Clarifai Client Id',
    clientSecret: 'Your Clarifai Client Secret'
  }
};