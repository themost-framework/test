import {DataObject,EdmMapping} from '@themost/data';
/**
 * @property {string} client_id
 * @property {string} name
 * @property {string} client_secret
 * @property {string} grant_type
 * @property {string} redirect_uri
 * @property {Array<*>} scopes
 */
@EdmMapping.entityType('AuthClient')
class AuthClient extends DataObject {
    constructor() {
        super();
    }

    /**
     * @param {string} grant_type
     * @returns {boolean}
     */
    hasGrantType(grant_type) {
        if (this.grant_type == null) {
            return false;
        }
        return (this.grant_type.split(',').indexOf(grant_type)>=0);
    }

    /**
     * @param {string} scope
     * @returns {Promise<boolean>}
     */
    async hasScope(scope) {
        if (typeof scope !== 'string') {
            throw new TypeError('Invalid argument. Scope must be a string');
        }
        // split scopes
        let scopes = scope.split(',');
        if (Array.isArray(this.scopes)) {
            let found = scopes.filter(scope => {
                return this.scopes.findIndex( x=> {
                   return new RegExp('^' + scope + '$','i').test(x.name);
                })>=0;
            }).length;
            return found === scopes.length;
        }
        // count scopes
        let count = await this.property('scopes').where('name').equal(scopes).silent().count();
        // count must be equal to scopes length
        return count === scopes.length;
    }

    /**
     * @param {string} redirect_uri
     * @returns {boolean}
     */
    hasRedirectUri(redirect_uri) {
        let re = new RegExp('^' + this.redirect_uri.replace('*','(.*?)') + '$','ig');
        return re.test(redirect_uri);
    }

}

export {
    AuthClient
}
