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
        program.parse();
        const args = program.opts();
        await serveApplication(getApplication(), args.port, args.host);
    }
    catch(err) {
        log(err);
        process.exit(1);
    }
})();
