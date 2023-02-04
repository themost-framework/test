/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import express from 'express';
import fs from 'fs';
import {
    Args,
    HttpBadRequestError,
    HttpForbiddenError,
    HttpNotFoundError, HttpTokenExpiredError,
    HttpTokenRequiredError,
    HttpUnauthorizedError
} from '@themost/common';
import passport from 'passport';
import BearerStrategy from 'passport-http-bearer';
import jwt from 'jsonwebtoken';

const User = require('../models/user-model');
// noinspection JSUnusedGlobalSymbols
/**
 * @param {{privateKey: string, publicKey: string}} options
 */
function authRouter(options) {

    
    let _privateKey;
    function getPrivateKey() {
        if (_privateKey == null) {
            return _privateKey = fs.readFileSync(options.privateKey);
        }
        return _privateKey;
    }
    let _publicKey;
    function getPublicKey() {
        if (_publicKey == null) {
            return _publicKey = fs.readFileSync(options.publicKey);
        }
        return _publicKey;
    }


    const publicKey = fs.readFileSync(options.publicKey);
    const privateKey = fs.readFileSync(options.privateKey);

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
            // get token info
            // noinspection JSUnresolvedFunction
            req.context.model('AccessToken').where('access_token').equal(token).silent().getItem().then(info => {
                if (info == null) {
                    return done(new HttpTokenExpiredError());
                }
                if (new Date(info.expires).getTime() < new Date().getTime()) {
                    return done(new HttpTokenExpiredError());
                }
                // find user from token info
                // noinspection JSUnresolvedFunction
                return req.context.model('User').where('name').equal(info.user_id).silent().getItem().then( user => {
                    // user cannot be found and of course cannot be authenticated (throw forbidden error)
                    if (user == null) {
                        return done(new HttpForbiddenError());
                    }
                    // check if user has enabled attribute
                    if (Object.prototype.hasOwnProperty.call(user, 'enabled') && !user.enabled) {
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

    let router = express.Router();

    router.post('/token', async function postToken (req, res, next) {
        try {
            // noinspection JSValidateTypes
            /**
             * @type {TokenReqBody}
             */
            const body = req.body;
            // validate grant type
            Args.check(body.grant_type === 'password',
                new HttpBadRequestError('Invalid grant type. Expected grant type password'));
            // validate client
            const client = await req.context.model('AuthClient').where('client_id').equal(body.client_id)
                .silent()
                .getTypedItem();
            Args.check(client != null, new HttpBadRequestError('Invalid client.'));
            // validate client secret
            Args.check(client.client_secret === body.client_secret, new HttpUnauthorizedError('Invalid client credentials'));
            // validate scope
            const hasScope = await client.hasScope(body.scope);
            Args.check(hasScope, new HttpBadRequestError('Invalid client scope.'));
            // validate user
            const validateUser = await User.validateUser(req.context, body.username, body.password);
            Args.check(validateUser,
                new HttpUnauthorizedError('Invalid user credentials'));
            //get expiration timeout
            const expirationTimeout = parseInt(req.context.application.getConfiguration().getSourceAt('auth/timeout') || 60, 10)*60*1000;
            const expirationTimeoutSeconds = parseInt(expirationTimeout / 1000);
            //calculate expiration time
            const expires = new Date().getTime() + expirationTimeout;

            const user = await req.context.model(User).where('name').equal(body.username).silent().getItem();

            const access_token = jwt.sign({
                sub: user.name,
                exp: expires,
                name: user.description,
                scope: body.scope.split(' '),
                client_id: body.client_id
            }, getPrivateKey(), { algorithm: 'RS256' });

            const refresh_token = jwt.sign({
                sub: user.name,
                exp: expires,
                name: user.description,
                scope: body.scope.split(' '),
                client_id: body.client_id
            }, getPrivateKey(), { algorithm: 'RS256' });

            return res.json({
                access_token: access_token,
                token_type: 'bearer',
                expires_in: expirationTimeoutSeconds,
                refresh_token: refresh_token,
                scope: body.scope
            });
            
        }
        catch (err) {
            return next(err);
        }
    });

    router.post('/token_info', async function postTokenInfo (req, res, next) {
        try {
            // noinspection JSValidateTypes
            /**
             * @type {TokenInfoReqBody}
             */
            const body = req.body;
            // get authorization header
            const authorizationHeader = req.header('Authorization');
            Args.check(authorizationHeader, new HttpUnauthorizedError('Missing client credentials.'));
            // convert base64 header to string
            let buff = Buffer.from(authorizationHeader.replace(/^Basic\s+/,''), 'base64');
            let authorizationHeaderText = buff.toString('ascii');
            // split text and get client credentials
            let match = /^(.*?):(.*?)$/.exec(authorizationHeaderText);
            Args.check(match != null, new HttpBadRequestError('Invalid authorization header.'));
            let client_id = match[1];
            let client_secret = match[2];
            // validate client
            const client = await req.context.model('AuthClient').where('client_id').equal(client_id)
                .and('client_secret').equal(client_secret).silent().getItem();
            Args.check(client != null, new HttpUnauthorizedError('Invalid client credentials.'));

            // validate toke
            const decoded = jwt.verify(body.token, getPublicKey());

            if (decoded == null) {
                // return non-active response
                return res.json({
                    active: false
                });
            }
            else {
                // if token has been expired
                if (new Date(decoded.exp).getTime() < new Date().getTime()) {
                    // return non-active response
                    return res.json({
                        active: false
                    });
                }// return token info
                return res.json(Object.assign(decoded, {
                    active: true
                }));
            }
        }
        catch (err) {
            return next(err);
        }
    });

    router.get('/me', async function getMe(req, res, next){
        try {
            // get authorization header
            const authorizationHeader = req.header('Authorization');
            Args.check(authorizationHeader, new HttpBadRequestError('Missing authorization header.'));
            // split text and get client credentials
            let match = /^Bearer\s(.*?)$/i.exec(authorizationHeader);
            Args.check(match != null, new HttpBadRequestError('Invalid authorization header.'));
            let token = match[1];
            // get token info
            const item = await req.context.model('AccessToken')
                .where('access_token').equal(token)
                .silent()
                .getItem();
            Args.check(item, new HttpForbiddenError());
            // check active
            const active = new Date(item.expires).getTime() >= new Date().getTime();
            Args.check(active, new HttpForbiddenError());
            // get user
            const user = await req.context.model('User')
                .where('name').equal(item.user_id)
                .silent()
                .getItem();
            Args.check(user, new HttpNotFoundError());
            // and return
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
            Args.notEmpty(req.body.password, 'Password');
            
            const client = await req.context.model('AuthClient').where('client_id').equal(client_id)
                .silent().getItem();
            Args.check(client != null, new HttpUnauthorizedError('Invalid client.'));
            const validateUser = await User.validateUser(req.context, username, req.body.password);
            Args.check(validateUser,
                new HttpUnauthorizedError('Wrong user name or bad password'));
            const scope = req.query.scope || 'profile';
            //get expiration timeout
            const expirationTimeout = parseInt(req.context.application.getConfiguration().getSourceAt('auth/timeout') || 60, 10)*60*1000;
            const expirationTimeoutSeconds = parseInt(expirationTimeout / 1000);
            const secret = req.context.application.getConfiguration().getSourceAt('settings/crypto/key');
            //calculate expiration time
            const expires = new Date().getTime() + expirationTimeout;
            //create new token or update an existing one
            let token = await req.context.model('AccessToken')
                .where('client_id').equal(client_id)
                .and('user_id').equal(username)
                .and('scope').equal(scope)
                .and('expires').lowerOrEqual(new Date())
                .silent()
                .getItem();
            if (token) {
                token.expires = new Date(expires);
            } else {
                token = {
                    client_id: client_id,
                    user_id: username,
                    scope: scope,
                    expires: new Date(expires)
                };
            }
            await req.context.model('AccessToken').silent().save(token);
            // and redirect
            const state = req.query.state;
            if (state) {
                return res.redirect(`${redirect_uri}?access_token=${token.access_token}&scope=${scope}&refresh_token=${token.refresh_token}&state=${state}`);
            }
            return res.redirect(`${redirect_uri}?access_token=${token.access_token}&scope=${scope}&refresh_token=${token.refresh_token}`);
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

export {authRouter};
