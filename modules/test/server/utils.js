/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import fetch from 'node-fetch';
import {URL, URLSearchParams} from 'url';
import {HttpError} from '@themost/common';

const TEST_CLIENT_ID = '9165351833584149';
const TEST_CLIENT_SECRET = 'hTgqFBUhCfHs/quf/wnoB_UpDSfUusKA';

/**
 * @param {string} server_uri
 * @param {string} username
 * @param {string} password
 * @return {Promise<TokenResBody>}
 */
async function getToken(server_uri, username, password) {
    const response = await fetch(new URL('/auth/token', server_uri), {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: TEST_CLIENT_ID,
            client_secret: TEST_CLIENT_SECRET,
            username: username,
            password: password,
            grant_type: 'password',
            scope: 'profile'
        }).toString()
    });
    if (response.ok) {
        return await response.json();
    }
    throw new HttpError(response.status);
}

async function getTokenInfo(server_uri, token) {
    const response = await fetch(new URL('/auth/token_info', server_uri), {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${new Buffer(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            token: token
        }).toString()
    });
    if (response.ok) {
        return await response.json();
    }
    throw new HttpError(response.status);
}

export {getToken, getTokenInfo, TEST_CLIENT_ID, TEST_CLIENT_SECRET};
