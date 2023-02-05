/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
    ApplicationService,
    Args,
    Guid,
    HttpBadRequestError,
    HttpForbiddenError,
    HttpTokenExpiredError,
    HttpTokenRequiredError,
    HttpUnauthorizedError,
    TraceUtils
} from '@themost/common';
import passport from 'passport';
import BearerStrategy from 'passport-http-bearer';
import { BasicStrategy } from 'passport-http';
import jwt from 'jsonwebtoken';
import { User } from '../models/user-model';

class Authenticator extends ApplicationService {
    /**
     * @param {import('@themost/express').ExpressDataApplication} app 
     */
    constructor(app) {
        super(app);
        const options = app.getConfiguration().getSourceAt('settings/jwt');
        const executionPath = app.getConfiguration().getExecutionPath();
        if (options && options.privateKey) {
            const privateKey = fs.readFileSync(path.resolve(executionPath, options.privateKey.replace(/^~\//g, './')));
            Object.defineProperty(this, 'privateKey', {
                configurable: false,
                enumerable: false,
                value: privateKey
            });
        }
        if (options && options.publicKey) {
            const publicKey = fs.readFileSync(path.resolve(executionPath, options.publicKey.replace(/^~\//g, './')));
            Object.defineProperty(this, 'publicKey', {
                configurable: false,
                enumerable: false,
                value: publicKey
            });
        }
    }

    /**
     * 
     * @param {import('@themost/data').DataContext} context 
     * @param {{client_id: string,client_secret:string,username: string,password: string, grant_type: string,scope:string}} authenticateUser 
     */
    async authenticate(context, authenticateUser) {
        Args.check(authenticateUser.grant_type === 'password',
                new HttpBadRequestError('Invalid grant type. Expected grant type password'));
        // validate client
        const client = await context.model('AuthClient').where('client_id').equal(authenticateUser.client_id)
            .silent()
            .getTypedItem();
        Args.check(client != null, new HttpBadRequestError('Invalid client.'));
        // validate client secret
        Args.check(client.client_secret === authenticateUser.client_secret, new HttpUnauthorizedError('Invalid client credentials'));
        // validate scope
        const hasScope = await client.hasScope(authenticateUser.scope);
        Args.check(hasScope, new HttpBadRequestError('Invalid client scope.'));
        // validate user
        const validateUser = await User.validateUser(context, authenticateUser.username, authenticateUser.password);
        Args.check(validateUser,
            new HttpUnauthorizedError('Invalid user credentials'));
        //get expiration timeout
        const expirationTimeout = parseInt(context.application.getConfiguration().getSourceAt('auth/timeout') || 60, 10)*60*1000;
        const expirationTimeoutSeconds = parseInt(expirationTimeout / 1000);
        //calculate expiration time
        const expires = new Date().getTime() + expirationTimeout;

        const user = await context.model(User).where('name').equal(authenticateUser.username).silent().getItem();

        // create JWT payload
        const payload = {
            sub: user.id,
            jti: Guid.newGuid(),
            aud: 'account',
            exp: expires,
            typ: 'Bearer',
            iss: 'urn:themost-framework:test',
            scope: authenticateUser.scope,
            name: user.description,
            username: user.name,
            preferred_username: user.name
        };
        const access_token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
        return {
            access_token: access_token,
            token_type: 'bearer',
            expires_in: expirationTimeoutSeconds,
            scope: authenticateUser.scope
        };
    }

    /**
     * @param {import('express').Request} req
     */
    async getRequestToken(req) {
        // get authorization header
        const authorizationHeader = req.header('Authorization');
        Args.check(authorizationHeader, new HttpBadRequestError('Missing authorization header.'));
        // split text and get client credentials
        let match = /^Bearer\s(.*?)$/i.exec(authorizationHeader);
        Args.check(match != null, new HttpBadRequestError('Invalid authorization header.'));
        let access_token = match[1];
        return this.getToken(req.context, access_token);
    }

    /**
     * @param {import('@themost/data').DataContext} context 
     * @param {string} access_token
     */
    async getToken(access_token) {
        // validate token
        let decoded
        try {
            decoded = jwt.verify(access_token, this.publicKey);
        }
        catch (err) {
            if (err.name === 'JsonWebTokenError') {
                TraceUtils.error(err);
                decoded = null;
            } else {
                throw err;
            }
        }
        
        if (decoded == null) {
            // return non-active response
            return {
                active: false
            };
        }
        else {
            // if token has been expired
            if (new Date(decoded.exp).getTime() < new Date().getTime()) {
                // return non-active response
                return {
                    active: false
                };
            }// return token info
            return Object.assign(decoded, {
                active: true
            });
        }
    }



}

// noinspection JSUnusedGlobalSymbols
function authRouter() {

    // passport bearer authorization strategy
    // https://github.com/jaredhanson/passport-http-bearer#usage
    // noinspection JSCheckFunctionSignatures
    passport.use(new BearerStrategy({
            passReqToCallback: true
        },
        /**
         * @param {Request} req
         * @param {string} token
         * @param {Function} done
         */
        function(req, token, done) {
            if (token == null) {
                // throw 499 Token Required error
                return done(new HttpTokenRequiredError());
            }

            /**
             * @type {Authenticator}
             */
            const authenticator = req.context.application.getService(Authenticator);
            authenticator.getToken(token).then((info) => {
                if (info == null) {
                    return done(new HttpTokenExpiredError());
                }
                if (info.active === false) {
                    return done(new HttpTokenExpiredError());
                }
                const username = info.username;
                return req.context.model('User').asQueryable().where((x) => {
                    return x.name === username;
                }, {
                    username
                }).silent().getItem().then((user) => {
                    if (user == null) {
                        return done(new HttpForbiddenError());
                    }
                    // check if user has enabled attribute
                    if (user.enabled === false) {
                        //if user.enabled is off throw forbidden error
                        return done(new HttpForbiddenError('Access is denied. User account is disabled.'));
                    }
                    // otherwise return user data
                    return done(null, {
                        'name': user.name,
                        'authenticationProviderKey': user.id,
                        'authenticationType': 'Bearer',
                        'authenticationToken': token,
                        'authenticationScope': info.scope
                    });
                });
            }).catch(err => {
                if (err && err.statusCode === 404) {
                    return done(new HttpTokenRequiredError('Token not found'));
                }
                // otherwise continue with error
                return done(err);
            });
        }
    ));

    passport.use(new BasicStrategy({
        passReqToCallback: true
    }, (req, client_id, client_secret, done) => {
        return req.context.model('AuthClient').asQueryable().where((x) => {
            return x.client_id === client_id && x.client_secret === client_secret;
        }, {
            client_id,
            client_secret
        }).silent().getItem().then((client) => {
            if (client === null) {
                return done(new HttpForbiddenError('Invalid client credentials'));
            }
            return done(null, {
                'name': client_id,
                'authenticationType': 'Basic'
            });
        }).catch(err => {
            return done(err);
        });
    }))

    let router = express.Router();

    router.post('/token', async function postToken (req, res, next) {
        try {
            // noinspection JSValidateTypes
            const result = await req.context.application.getService(Authenticator).authenticate(req.context, req.body);
            return res.json(result);            
        }
        catch (err) {
            return next(err);
        }
    });

    router.post('/token_info', passport.authenticate('basic', { session: false }), async function postTokenInfo (req, res, next) {
        try {
            const info = await req.context.application.getService(Authenticator).getToken(req.body && req.body.token);
            return res.json(info);
        }
        catch (err) {
            return next(err);
        }
    });

    router.get('/me', passport.authenticate('bearer', { session: false }), async function getMe(req, res, next){
        try {
            const username = req.context && req.context.user && req.context && req.context.user.name;
            const user = await req.context.model('User').asQueryable().where((x) => {
                return x.name === username;
            }, {
                username
            }).expand((x) => x.groups).getItem();
            return res.json(user);
        }
        catch (err) {
            return next(err);
        }

    });

    router.get('/', (req, res) => {
        return res.redirect('login');
    });

    router.get('/login', async function getLogin(req, res) {
         const client_id = req.query.client_id;
         const redirect_uri = req.query.redirect_uri || '/';
         if (client_id == null) {
             // redirect with default test client_id
             return res.redirect(`login?client_id=9165351833584149&scope=profile&redirect_uri=${redirect_uri}`);
         }
         res.render('login', { title: 'test api server', error: null });
    });

    router.post('/login', async function postLogin(req, res) {
        try {
            // get client_id
            const client_id = req.query.client_id;
            Args.notEmpty(client_id, 'Client application');
            // get client_id
            const redirect_uri = req.query.redirect_uri;
            Args.notEmpty(redirect_uri, 'Redirect URI');
            // validate user name and password
            const username = req.body.username;
            Args.notEmpty(username, 'Username');

            const password = req.body.password;
            Args.notEmpty(password, 'Password');

            const scope = req.query.scope || 'profile';

            const grant_type = 'password';
            
            const client = await req.context.model('AuthClient').where('client_id').equal(client_id)
                .silent().getItem();
            Args.check(client != null, new HttpUnauthorizedError('Invalid client.'));
            const client_secret = client.client_secret;

            const token = await req.context.application.getService(Authenticator).authenticate(req.context, {
                client_id,
                client_secret,
                username,
                password,
                grant_type,
                scope
            });
            // and redirect
            const state = req.query.state;
            if (state) {
                return res.redirect(`${redirect_uri}?access_token=${token.access_token}&scope=${scope}&state=${state}`);
            }
            return res.redirect(`${redirect_uri}?access_token=${token.access_token}&scope=${scope}`);
        } catch(err) {
            res.render('login', { title: 'test api server', error: err });
        }
        
    });

    router.get('/logout', async function getLogout(req, res, next) {
        try {
            const authorizationHeader = req.header('Authorization');
            Args.check(authorizationHeader, new HttpUnauthorizedError('Missing client credentials.'));
            let match = /^Bearer\s(.*?)$/i.exec(authorizationHeader);
            Args.check(match != null, new HttpBadRequestError('Invalid authorization header.'));
            let access_token = match[1];
            const continue_uri = req.query.continue;
            let token = await req.context.model('AccessToken').where('access_token').equal(access_token)
                .silent().getItem();
            Args.check(token != null, new HttpBadRequestError('Invalid token.'));
            token.expires = new Date();
            await req.context.model('AccessToken').silent().save(token);
            if (continue_uri) {
                res.redirect(continue_uri);
            }
            return res.status(204).send();
        } catch (err) {
            return next(err);
        }
        
    });

    return router;
}

export {authRouter, Authenticator};
