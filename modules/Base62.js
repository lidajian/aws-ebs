/*
 * Author       : Dajian Li
 * Email        : dajian@desti.me
 * Description  : Base62 encode and decode of strings and integer
 */

var Base62 = {}
/*
Base62._charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

Base62.hashCode = function (string) {
    var hash = 5381;
    for (i = 0; i < string.length; i++) {
        var c = string.charCodeAt(i);
        hash = c + ((hash << 5) + hash);
    }
    return hash + (new Date()).getTime(); // Add timestamp
}
*/

Base62.encode = function(positive_integer) {
    if (positive_integer == 0) {
        return '0';
    }
    var s = '';
    while (positive_integer > 0) {
        s = s + Base62._charset[positive_integer % 62];
        positive_integer = Math.floor(positive_integer / 62);
    }
    return s;
}

/*
Base62.encodes = function(string) {
    var hash = this.hashCode(string);
    return this.encode(Math.abs(hash));
}
*/

module.exports = Base62;

