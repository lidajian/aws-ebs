/*
 * Author       : Dajian Li
 * Email        : dajian@desti.me
 * Description  : Get environment name, version label, file name from id
 */

module.exports = {
    toEnvironmentName : (id) => 'e-' + id,
    toVersionLabel    : (id) => 'v-' + id,
    toFileName        : (id) => 'f-' + id
};
