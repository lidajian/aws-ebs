/*
 * Author       : Dajian Li
 * Email        : dajian@desti.me
 * Description  : Provide operations to AWS Services(S3, ElasticBeanstalk)
 * Prerequisite : AWS_REGION environment set
 */

var aws = require('aws-sdk');

module.exports = (opts) => {
    opts.eb = new aws.ElasticBeanstalk({apiVersion: '2012-12-01'});
    opts.s3 = new aws.S3({apiVersion: '2006-03-01'});

    /*
     * Delete S3 object
     */
    opts.deleteS3Object = function(filename) {
        if (filename == null) return;
        var params = {
            Bucket : this.codeBucket,
            Key    : filename
        };
        this.s3.deleteObject(params, function(err, data){
            if (err) console.log('[aws]Fail to delete object:', filename);
            else console.log('[aws]Attempted to object:', filename);
        });
    }

    /*
     * Delete application version
     */
    opts.deleteApplicationVersion = function(verLabel) {
        if (verLabel == null) return;
        var params = {
            ApplicationName    : this.appName,
            DeleteSourceBundle : true,
            VersionLabel       : verLabel
        };

        this.eb.deleteApplicationVersion(params, function(err, data){
            if (err) console.log('[aws]Fail to delete version:', verLabel);
            else console.log('[aws]Attempted to delete version:', verLabel);
        });
    }

    /*
     * Terminate environment
     */
    opts.terminateEnvironment = function(envName) {
        if (envName == null) return;
        var params = {
            EnvironmentName    : envName,
            TerminateResources : true
        };

        this.eb.terminateEnvironment(params, function(err, data) {
            if (err) console.log('[aws]Fail to terminate environment:', envName);
            else console.log('[aws]Attempted to terminate environment:', envName);
        });
    }

    /*
     * Describe environment
     */
    opts.describeEnvironments = function(envName, cb) {
        var params = {
            EnvironmentNames : [envName]
        };

        return this.eb.describeEnvironments(params, cb);
    }

    /*
     * Create application version
     */
    opts.createApplicationVersion = function(verLabel, verDescription,
                                                           filename, cb) {
        var params = {
            ApplicationName : this.appName,
            VersionLabel    : verLabel,
            Description     : verDescription,
            SourceBundle    : {
                S3Bucket    : this.codeBucket,
                S3Key       : filename
            }
        };

        return this.eb.createApplicationVersion(params, cb);
    }

    /*
     * Create environment
     */
    opts.createEnvironment = function(envName, envStack, verLabel, cb) {
        var params = {
            ApplicationName   : this.appName,
            EnvironmentName   : envName,
            SolutionStackName : envStack,
            VersionLabel      : verLabel,
            OptionSettings    : [
                {
                    Namespace  : 'aws:autoscaling:launchconfiguration',
                    OptionName : 'IamInstanceProfile',
                    Value      : 'aws-elasticbeanstalk-ec2-role'
                },
                {
                    Namespace  : 'aws:elasticbeanstalk:environment',
                    OptionName : 'ServiceRole',
                    Value      : 'aws-elasticbeanstalk-service-role'
                },
                {
                    Namespace  : 'aws:elasticbeanstalk:environment',
                    OptionName : 'EnvironmentType',
                    Value      : 'SingleInstance'
                }
            ]
        };

        return this.eb.createEnvironment(params, cb);
    }

    /*
     * Describe events
     */
    opts.describeEvents = function(envName, cb) {
        var params = {
            EnvironmentName : envName,
            Severity        : 'ERROR'
        };

        return this.eb.describeEvents(params, cb);
    };

    return opts;
}
