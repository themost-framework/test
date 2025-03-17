import { getApplication, finalizeApplication, serveApplication, getServerAddress, getToken, getTokenInfo } from '../modules/test/server';
import { promisify } from 'es6-promisify';
import { URL, URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { EdmSchema } from '@themost/client';

describe('app', function() {

  /**
   * @type {import('express').Application}
   */
  let app;
  /**
   * @type {Server}
   */
  let server;
  beforeAll(async () => {
    app = getApplication();
    server = await serveApplication(app);
  });

  afterAll(async () => {
    if (app) {
      await finalizeApplication(app);
    }
    if (server) {
      await promisify(server.close).bind(server)();
    }
  });

  it('should get app', async () => {
    expect(app).toBeTruthy();
  });
  it('should serve app', async () => {
    expect(server).toBeTruthy();
    // get address info
    const addressInfo = server.address();
    expect(addressInfo).toBeTruthy();
    expect(addressInfo.address).toBeTruthy();
    expect(addressInfo.port).toBeTruthy();
  });

  it('should get json error', async () => {
    // serve
    const base = getServerAddress(server);
    // get metadata
    const response = await fetch(new URL('/missing', base), {
      headers: {
        'Accept': 'application/json'
      }
    });
    expect(response.ok).toBeFalsy();
    const body = await response.json();
    expect(body).toBeTruthy();
  });

  it('should post /auth/token', async () => {
    const base = getServerAddress(server);
    // get metadata
    const response = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: '9165351833584149',
        client_secret: 'hTgqFBUhCfHs/quf/wnoB_UpDSfUusKA',
        username: 'alexis.rees@example.com',
        password: 'secret',
        grant_type: 'password',
        scope: 'profile'
      }).toString()
    });
    expect(response.ok).toBeTruthy();
    const body = await response.json();
    expect(body).toBeTruthy();
  });
  it('should post /auth/token_info', async () => {
    const base = getServerAddress(server);
    // get metadata
    let response = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: '9165351833584149',
        client_secret: 'hTgqFBUhCfHs/quf/wnoB_UpDSfUusKA',
        username: 'alexis.rees@example.com',
        password: 'secret',
        grant_type: 'password',
        scope: 'profile'
      }).toString()
    });
    expect(response.ok).toBeTruthy();
    const token = await response.json();
    expect(token).toBeTruthy();
    response = await fetch(new URL('/auth/token_info', base), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from('9165351833584149:hTgqFBUhCfHs/quf/wnoB_UpDSfUusKA').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: token.access_token
      }).toString()
    });
    expect(response.ok).toBeTruthy();
    const token_info = await response.json();
    expect(token_info).toBeTruthy();
    expect(token_info.active).toBeTruthy();
  });

  it('should post /auth/me', async () => {
    const base = getServerAddress(server);
    // get metadata
    let response = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: '9165351833584149',
        client_secret: 'hTgqFBUhCfHs/quf/wnoB_UpDSfUusKA',
        username: 'alexis.rees@example.com',
        password: 'secret',
        grant_type: 'password',
        scope: 'profile'
      }).toString()
    });
    expect(response.ok).toBeTruthy();
    const token = await response.json();
    expect(token).toBeTruthy();
    response = await fetch(new URL('/auth/me', base), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    expect(response.ok).toBeTruthy();
    const me = await response.json();
    expect(me).toBeTruthy();
    expect(me.name).toBe('alexis.rees@example.com');
  });

  it('should use getToken()', async () => {
    const server_uri = getServerAddress(server);
    // get token
    let token = await getToken(server_uri, 'alexis.rees@example.com', 'secret');
    expect(token).toBeTruthy();
    expect(token.access_token).toBeTruthy();
    // unauthorized
    try {
      token = await getToken(server_uri, 'alexis.rees@example.com', 'test');
      expect(token).toBeFalsy();
    }
    catch (err) {
      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(401);
    }
  });

  it('should use getTokenInfo()', async () => {
    const server_uri = getServerAddress(server);
    // get token
    let token = await getToken(server_uri, 'alexis.rees@example.com', 'secret');
    expect(token).toBeTruthy();
    let tokenInfo = await getTokenInfo(server_uri, token.access_token);
    expect(tokenInfo).toBeTruthy();
    expect(tokenInfo.active).toBeTruthy();
    // active false
    tokenInfo = await getTokenInfo(server_uri, 'test-token');
    expect(tokenInfo.active).toBeFalsy();
  });

  it('should get metadata as anonymous', async () => {
    const server_uri = getServerAddress(server);
    let response = await fetch(new URL('/api/$metadata', server_uri), {
      method: 'GET',
      headers: {
        'Accept': 'application/xml'
      }
    });
    expect(response.ok).toBeTruthy();
    const body = await response.text();
    expect(body).toBeTruthy();
    const schema = EdmSchema.loadXML(body);
    expect(schema).toBeTruthy();
    expect(schema.EntityType.length).toBeGreaterThan(0);

  });

});
