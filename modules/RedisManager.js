/*
 * Author       : Dajian Li
 * Email        : dajian@desti.me
 * Description  : Redis operation
 *
 * req:
 * Key: id
 * Value: url, "" if not exist
 */

var redis = require('redis');

module.exports = (opts) => {
    opts.client = redis.createClient(opts);

    /*
     * Insert data
     * arg: {id:_, url:_}
     */
    opts.set = function(arg) {
        if (arg.url) {
            this.client.hset('req', arg.id, arg.url, function(err, result){
                if (err) console.log(err, '[redis]Fail to record the request:', arg.id);
                else console.log('[redis]Recorded the request:', arg.id);
            });
        } else {
            this.client.hset('req', arg.id, '', function(err, result){
                if (err) console.log(err, '[redis]Fail to record the request:', arg.id);
                else console.log('[redis]Recorded the request:', arg.id);
            });
        }
    }

    /*
     * Insert data if not exist else update
     * arg: {id:_, url:_}
     */
    opts.setOrUpdate = function(arg) {
        if (arg.url) {
            this.client.hset('req', arg.id, arg.url, function(err, result){
                if (err) console.log(err, '[redis]Fail to record the request:', arg.id);
                else console.log('[redis]Recorded the request:', arg.id);
            });
        } else {
            this.client.hset('req', arg.id, '', function(err, result){
                if (err) console.log(err, '[redis]Fail to record the request:', arg.id);
                else console.log('[redis]Recorded the request:', arg.id);
            });
        }
    }

    /*
     * Get row with certain id
     * cb: function(err, results)
     */
    opts.get = function(id, cb) {
        this.client.hget('req', id, cb);
    }

    /*
     * Update url to ''
     * cb: function(err, results)
     */
    opts.setNull = function(id, cb) {
        this.client.hset('req', id, '', cb);
    }

    /*
     * Get all record
     * cb: function(err, results)
     */
    opts.getall = function(cb) {
        this.client.hgetall('req', cb);
    }

    /*
     * Increment the counter and get the new count
     * cb: function(err, results)
     */
    opts.nextCount = function(cb) {
        this.client.incr(this.cnt_key_name, cb);
    }

    return opts;
}
