/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import {Authenticator as PassportAuthenticator, PassportStatic} from "passport";
import {Router} from "express";
import {ApplicationService} from '@themost/common';
import {DataContext} from '@themost/data';

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

export declare interface TokenInfoResBody {
    active: string;
    scope?: string;
    client_id?: string;
    username?: string;
    exp?: number;
}

export declare interface TokenResBody {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export declare interface AuthenticatedUser {
    client_id: string,
    client_secret:string,
    username: string,
    password: string,
    grant_type: string,
    scope:string
}

declare function authRouter(passport: PassportStatic): Router;
declare function authorize(passport: PassportAuthenticator): Router;

declare class Authenticator extends ApplicationService {
    async authenticate(context: DataContext, authenticateUser: AuthenticatedUser): Promise<{
        access_token: string,
        token_type: 'bearer',
        expires_in: number,
        scope: string
    }>;
}

export {authorize, authRouter, Authenticator};
