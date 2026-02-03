#!/usr/bin/env node
/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2017, THEMOST LP All rights reserved
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import {serveApplication} from './serve';
import debug from 'debug';
import path from 'path';
import {getApplication} from './app';
import { Command, Option } from 'commander';
const log = debug('themost-framework:test');
(async function() {
    try {
        const program = new Command();
        program
            .name('npx @themost/test')
            .description('starts @themost-framework test api server')
            .version('2')
            .addOption(new Option('-p, --port <number>', 'port number').env('PORT'))
            .addOption(new Option('-h, --host <string>', 'host address').env('IP'))
            .addOption(new Option('-a, --path <string>', 'application path'))
            .addOption(new Option('-o, --origin <string>', 'api server origin e.g. https://api.example.com').default('http://localhost:3000'));
        program.parse();
        const args = program.opts();
        /**
         * @type string
         */
        let cwd;
        if (args.path) {
            cwd = path.resolve(process.cwd(), args.path);
        }
        const app = getApplication(cwd);
        /**
         * @type {import('@themost/express').ExpressDataApplication}
         */
        const service = app.get('ExpressDataApplication');
        service.configuration.setSourceAt('settings/api/origin', args.origin);
        await serveApplication(app, args.port, args.host);
    }
    catch(err) {
        log(err);
        process.exit(1);
    }
})();
