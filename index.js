/*
 * Author       : Dajian Li
 * Email        : dajian.li92@gmail.com
 * Description  : Deployment REST API
 * Prerequisite : AWS_REGION, REDIS_ENDPOINT environment set
 */

var express = require('express');
var multer  = require('multer');

var s3storage    = require('./modules/S3Storage');
var base62       = require('./modules/Base62');
var platforms    = require('./modules/EBSPlatform');
var idmanager    = require('./modules/IDManager');
var aws          = require('./modules/AWSManager')({
    appName    : 'UserCodeDeployment',
    codeBucket : 'destime-deployment'
});

var dbmanager = require('./RedisManager')({
    cnt_key_name    : 'cnt',
    host            : process.env.REDIS_ENDPOINT
});

var MAX_SEQ           = 8;
var DESCRIBE_INTERVAL = 30000;
var SERVICE_TIMEOUT   = 300000; // 5 minutes (Also timeout of AWS Lambda)

var app = express();

app.set('view engine', 'ejs');

app.get('/', function(req, res){
    dbmanager.getall(function(err, results){
        if (err) {
            res.status(404).end('404 Not Found');
        } else {
            res.render('index', {rows: results});
        }
    });
});

// Get the url and redirect
app.get('/i/:id', function(req, res){
    var id = req.params.id;
    var envName = idmanager.toEnvironmentName(id);
    dbmanager.get(id, function(err, result){
        if (err || result == null || result.length === 0) {
            res.status(404).end('404 Not Found');
        } else {
            res.redirect(301, 'http://' + result);
        }
    });
});

// DELETE: close resources
app.get('/api/awsebsd', function(req, res) {
    if (req.query.id) {
        var id = req.query.id;

        dbmanager.setNull(id, function(err, results){
            if (err) {
                console.log('[close]Invalid Id:', id);

                res.status(400).json({
                    success : false,
                    message : '[ARG] Invalid Id'
                });
            } else {
                console.log('[close]Closing:', id);

                // Clean up the environment
                aws.terminateEnvironment(idmanager.toEnvironmentName(id));

                // Clean up the version
                aws.deleteApplicationVersion(idmanager.toVersionLabel(id));

                res.json({
                    success : true
                });
            }
        });
    } else {
        res.status(400).json({
            success : false,
            message : '[ARG] Id field empty'
        });
    }
});

// GET: get status of resource
app.get('/api/awsebs', function(req, res){
    if (req.query.id) {
        var id = req.query.id;
        var envName = idmanager.toEnvironmentName(id);

        aws.describeEnvironments(envName).promise().then(
            function(data) {
                console.log('[describe]Describing:', id);

                if (data.Environments[0].Health === 'Green') {
                    dbmanager.setOrUpdate({
                        id  : id,
                        url : data.Environments[0].EndpointURL
                    });

                    // TODO get detail
                    res.json({
                        success : true,
                        status  : 'Healthy'
                    });
                } else if (data.Environments[0].Health === 'Red') {
                    dbmanager.setOrUpdate({
                        id  : id,
                    });

                    // TODO get reason
                    res.json({
                        success : true,
                        status  : 'Unhealthy',
                    });
                } else {
                    dbmanager.setOrUpdate({
                        id  : id,
                    });

                    // TODO get reason
                    res.json({
                        success : true,
                        status  : 'Unknown',
                    });
                }
            }
        ).catch(
            function(err) {
                console.log('[describe]AWS Error:', id);

                res.status(500).json({
                    success : false,
                    message : '[AWS] Service error'
                });
            }
        )
    } else {
        res.status(400).json({
            success : false,
            message : '[ARG] Id field empty'
        });
    }

});

/*
 * POST /api/awsebs
 * Upload code and launch a environment
 */
app.post('/api/awsebs', function(req, res) {
    dbmanager.nextCount(function(err, result){
        if (err || result == null) {
            console.log('[launch]Fail to get id from Redis');

            res.status(500).json({
                success : false,
                message : '[AWS] Fail to get id from Redis.'
            });
        } else {
            // Create uid
            var id = base62.encode(((new Date()).getTime() * MAX_SEQ) + (Number(result) % MAX_SEQ));

            var filename = idmanager.toFileName(id);

            var upload = multer({
                storage: s3storage({
                    s3client : aws.s3,
                    filename : filename,
                    bucket   : aws.codeBucket})
            }).single('userFile');

            upload(req, res, function(err, data){
                if (err) {
                    console.log('[launch]Fail to upload:', err);

                    res.status(500).json({
                        success : false,
                        message : '[ARG] Fail to upload file.'
                    });
                } else {
                    console.log('[launch]Uploaded:', filename);

                    if (req.body.userid == null) {
                        res.status(400).json({
                            success : false,
                            message : '[ARG] User Id not found.'
                        });

                        // remove the S3 object
                        deleteS3Object(filename);
                        return;
                    }

                    // Get deploy platform from parameter env
                    var envPlatform = platforms[req.body.platform];
                    if (envPlatform == null) {
                        res.status(400).json({
                            success : false,
                            message : '[ARG] Invalid platform'
                        });

                        // remove the S3 object
                        deleteS3Object(filename);
                        return;
                    }

                    var verLabel = idmanager.toVersionLabel(id);
                    var verDescription = 'The code by user: ' + req.body.userid;

                    aws.createApplicationVersion(verLabel, verDescription, filename,
                                                 function(err, data) {
                        if (err) {
                            console.log('[launch]Fail to create application version:', err);

                            res.status(500).json({
                                success : false,
                                message : '[AWS] Fail to create application version'
                            });

                            deleteS3Object(filename);
                        } else {
                            console.log('[launch]Created version:', verLabel);

                            var envName = idmanager.toEnvironmentName(id);
                            var envStack = '64bit Amazon Linux 2017.03 v4.2.2 running ' + envPlatform;

                            aws.createEnvironment(envName, envStack, verLabel, function(err, data) {
                                if (err) {
                                    console.log('[launch]Fail to create environment:', err);

                                    res.status(500).json({
                                        success : false,
                                        message : '[AWS] Fail to create environment'
                                    });

                                    dbmanager.set({
                                        id : id
                                    });

                                    // Clean up the version
                                    aws.deleteApplicationVersion(verLabel);

                                } else {

                                    console.log('[launch]Creating environment:', envName);

                                    var intervalId = setInterval(function(){
                                        aws.describeEnvironments(envName, function (err, data) {
                                            if (err) {

                                                clearInterval(intervalId);

                                                console.log('[launch]Fail to describe environment:', envName);

                                                res.json({
                                                    success : true,
                                                    id      : id,
                                                    message : '[AWS] Fail to get endpoint'
                                                });

                                                dbmanager.set({
                                                    id : id
                                                });
                                            } else {

                                                if (data.Environments[0].Health === 'Green') {
                                                    clearInterval(intervalId);
                                                    console.log('[launch]Environment turns green:', envName);

                                                    var url = data.Environments[0].EndpointURL;

                                                    aws.describeEvents(envName, function(err, data){
                                                        if (err) {
                                                            console.log('[launch]Fail to describe event:', envName);

                                                            res.json({
                                                                success : true,
                                                                id      : id,
                                                                message : '[AWS] Fail to get event'
                                                            });

                                                            dbmanager.set({
                                                                id : id
                                                            });
                                                        } else if (data.Events.length > 0) {
                                                            console.log('[launch]Environment has an issue:', envName);

                                                            res.json({
                                                                success : true,
                                                                id      : id,
                                                                message : '[AWS] The code has an issue'
                                                            });

                                                            dbmanager.set({
                                                                id : id
                                                            });
                                                        } else {
                                                            console.log('[launch]Environment launch success:', envName);

                                                            res.json({
                                                                success : true,
                                                                id      : id
                                                            });

                                                            dbmanager.set({
                                                                id  : id,
                                                                url : url
                                                            });
                                                        }
                                                    });

                                                } else if (data.Environments[0].Health !== 'Grey') {
                                                    clearInterval(intervalId);

                                                    console.log('[launch]Environment has an issue:', envName);

                                                    res.json({
                                                        success : true,
                                                        id      : id,
                                                        message : '[AWS] The code has an issue'
                                                    });

                                                    dbmanager.set({
                                                        id : id
                                                    });
                                                }
                                            }
                                        });
                                    }, DESCRIBE_INTERVAL);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

var server = app.listen(8080);
server.timeout = SERVICE_TIMEOUT;

console.log('Server started');
