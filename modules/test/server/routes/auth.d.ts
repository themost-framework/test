/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import {Authenticator} from "passport";
import {Router} from "express";

export declare interface TokenReqBody {
    client_id: string;
    client_secret: string;
    username: string;
    password: string;
    grant_type: string;
    scope: string;
}
export declare interface TokenInfoReqBody {
    token: string;
}

export declare interface TokenResBody {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

declare function authRouter(): Router;
declare function authorize(passport: Authenticator): Router;

export {authorize, authRouter};
