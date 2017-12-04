/*
 * Author       : Dajian Li
 * Email        : dajian@desti.me
 * Created      : 08/06/2017
 * Description  : customized multer storage that directly upload to AWS S3
 */

function S3Storage (opts) {
    if (opts.s3client) {
        this.s3client = opts.s3client;
    }
    this.filename = opts.filename;
    this.bucket   = opts.bucket;
}

S3Storage.prototype._handleFile = function _handleFile (req, file, cb) {
    var params = {
        Bucket : this.bucket,
        Key    : this.filename,
        Body   : file.stream
    };

    if (this.s3client) {
        this.s3client.upload(params, function(err, data){cb(err, data);});
    } else {
        var aws = require('aws-sdk');
        var s3client = new aws.S3({apiVersion: '2006-03-01'});
        s3client.upload(params, function(err, data){cb(err, data);});
    }
}

S3Storage.prototype._removeFile = function _removeFile (req, file, cb) {
    cb(null);
}

module.exports = function (opts) {
    return new S3Storage(opts);
}
