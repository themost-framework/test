[![npm](https://img.shields.io/npm/v/@themost%2Ftest.svg)](https://www.npmjs.com/package/@themost%2Ftest)
![](https://github.com/themost-framework/themost-test/workflows/test/badge.svg) 
![GitHub top language](https://img.shields.io/github/languages/top/themost-framework/test)
[![License](https://img.shields.io/npm/l/@themost/test)](https://github.com/themost-framework/themost-test/blob/master/LICENSE)
![GitHub last commit](https://img.shields.io/github/last-commit/themost-framework/test)
![GitHub Release Date](https://img.shields.io/github/release-date/themost-framework/test)
[![npm](https://img.shields.io/npm/dw/@themost/test)](https://www.npmjs.com/package/@themost%2Ftest)
[![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/@themost/test)](https://snyk.io/vuln/npm:%40themost%2Ftest)

## @themost/test
MOST Web Framework Codename Blueshift Test Api Server

This project contains a test api server for testing libraries and modules.

### Installation

        npm i @themost/test
        
### Usage

Start a standalone instance of test api server:

        npx @themost/test [--port <port>] [--host <host>]

or create a jasmine test spec and start testing api server

        import { getApplication, serveApplication, getServerAddress } from "@themost/test";
        import fetch from "node-fetch";
        describe("TestApi", () => {
          let server;
          let server_uri;
          beforeAll(done => {
            const app = getApplication()
            serveApplication(app)
              .then(liveServer => {
                server = liveServer;
                server_uri = getServerAddress(server);
                return done();
              })
              .catch(err => {
                return done(err);
              });
          });
          afterAll(done => {
            if (server) {
              server.close(() => {
                return done();
              });
            }
          });
          it("should access server", async () => {
            expect(server).toBeTruthy();
            const response = await fetch(new URL("/", server_uri));
            expect(response.ok).toBeTruthy();
          });
        });

#### Karma Testing

Test api server may be used alongside with [karma](https://github.com/karma-runner/karma) for testing.

Create karma-test-api-server.js:

    // karma-test-api-server.js
    const {getApplication, serveApplication, getServerAddress} = require('@themost/test');
    const { URL } = require('url');
    function serveKarmaTestApiServer(proxies) {
        const app = getApplication();
        return serveApplication(app).then( function(liveServer) {
            const serverAddress = getServerAddress(liveServer);
            Object.assign(proxies, {
                '/api/': new URL('/api/', serverAddress).toString(),
                '/auth/': new URL('/auth/', serverAddress).toString()
            });
        });
    }
    
    serveKarmaTestApiServer.$inject = ['config.proxies'];
    
    module.exports =  {
        'framework:api': [
            'factory',
            serveKarmaTestApiServer
        ]
    };

and modify karma.conf.js to include test api server

    // karma.conf.js
    module.exports = function (config) {
      config.set({
        basePath: '',
        frameworks: [..., ..., 'api'],
        plugins: [
          require('./karma-test-api-server'),
          ...
        ],
        client: {
          clearContext: false
        }
        ...
        
