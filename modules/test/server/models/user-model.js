import {EdmMapping} from '@themost/data';
import {TextUtils} from '@themost/common';
import { Account } from './account-model';
/**
 * @class

 * @property {Date} lockoutTime
 * @property {number} logonCount
 * @property {boolean} enabled
 * @property {Date} lastLogon
 * @property {Array<Group|any>} groups
 * @property {number} userFlags
 * @property {number} id
 */
@EdmMapping.entityType('User')
class User extends Account {
    /**
     * @constructor
     */
    constructor() {
        super();
    }

    /**
     * Gets the interactive user
     * @param context
     * @returns {Promise<User>}
     */
    @EdmMapping.func('Me', 'User')
    static async getMe(context) {
        return await context.model('User').where('name').equal(context.user && context.user.name).getTypedItem();
    }

    /**
     *
     * @param {ExpressDataContext} context
     * @param {string} username
     * @param {string} password
     */
    static async validateUser(context, username, password) {
        const user = await context.model('User')
            .select('id', 'name')
            .where('name').equal(username)
            .silent()
            .getItem();
        if (user == null) {
            return false;
        }
        return await context.model('UserCredential')
            .silent()
            .where('userPassword').equal('{clear}'.concat(password))
            .or('userPassword').equal('{md5}' + TextUtils.toMD5(password))
            .or('userPassword').equal('{sha1}' + TextUtils.toSHA1(password))
            .prepare()
            .and('id').equal(user.id).count();

    }

}
export {
    User
}
