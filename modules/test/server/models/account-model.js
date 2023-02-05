import {EdmMapping} from '@themost/data';
import { Thing } from './thing-model';
/**
 * @class
 
 * @property {number} id
 */
@EdmMapping.entityType('Account')
class Account extends Thing {
    /**
     * @constructor
     */
    constructor() {
        super();
    }
}
export {
    Account
};
