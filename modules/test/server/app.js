
import express from 'express';
import { ViewEngine } from '@themost/ejs';
import path from 'path';
import passport from 'passport';
import { authRouter } from './routes/auth';
// eslint-disable-next-line no-unused-vars
import { ExpressDataApplication, serviceRouter, getMetadataDocument, dateReviver, ExpressDataContext } from '@themost/express';
import { indexRouter } from './routes/index';
import temp from 'temp';
import fs from 'fs';
import cors from 'cors';
import { Authenticator } from './routes/auth';
import { docsRouter } from './routes/docs';
import createError from 'http-errors';
import { HttpUnauthorizedError } from '@themost/common';
import {DataCacheStrategy, ODataModelBuilder} from '@themost/data';
import { addPath } from 'app-module-path';
import { setContext } from '@themost/express';
import onHeaders from 'on-headers';

/**
 * @param {string} cwd
 * @returns {Express}
 */
function getApplication(cwd) {

  // resolve application directory
  let applicationDir = __dirname;
  if (typeof cwd === 'string' && cwd.length > 0) { // if current directory is defined
    applicationDir = path.resolve(process.cwd(), cwd);
  }
  /**
   * @name testDatabase
   * @description Holds the path of temporary test database path. At the end of application lifecycle, this database file is going to be removed.
   * @type {string}
   */
  let testDatabase;
  // if application is the current directory
  if (applicationDir === __dirname) {
    // prepare to create a copy of test database
    const config = require('./config/app.json');
    // prepare temp database
    const findAdapter = config.adapters.find(adapter => {
      return adapter.name === 'test';
    });
    if (findAdapter) {
      // get temp database path
      testDatabase = temp.path('.db');
      // copy database to temp path
      fs.copyFileSync(path.resolve(__dirname, 'db/local.db'), testDatabase);
      // update database path
      findAdapter.options.database = testDatabase;
    }
  } else {
    addPath(applicationDir);
  }
  /**
   * @name Request#context
   * @description Gets an instance of ExpressDataContext class which is going to be used for data operations
   * @type {ExpressDataContext}
   */
  /**
   * @name express.Request#context
   * @description Gets an instance of ExpressDataContext class which is going to be used for data operations
   * @type {ExpressDataContext}
   */

  /**
   * Initialize express application
   * @type {Express}
   */
  let app = express();

  // enable CORS
  app.use(cors({ origin: true, credentials: true }));

  app.use('/assets', express.static(path.join(__dirname, 'assets')))

  // use ViewEngine for all ejs templates
  app.engine('ejs', ViewEngine.express());
  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');

  app.use(express.json({
    reviver: dateReviver
  }));
  app.use(express.urlencoded({ extended: true }));

  // @themost/data data application setup
  const serviceApplication = new ExpressDataApplication(path.resolve(applicationDir, 'config'));

  if (applicationDir !== __dirname) {
    // update application configuration for including private and public key
    // this operation is important for using @themost/test authenticator
    serviceApplication.getConfiguration().setSourceAt('settings/jwt', {
      'publicKey': path.resolve(__dirname, 'config/public.pem'),
      'privateKey': path.resolve(__dirname, 'config/private.key')
    });

  }

  if (serviceApplication.hasService(Authenticator) === false) {
    serviceApplication.useService(Authenticator);
  }

  const builder = serviceApplication.getService(ODataModelBuilder);

  function getContextLink(context) {
      const origin = context.application.getConfiguration().getSourceAt('settings/api/origin') || 'http://localhost:3000';
      return new URL('/api/$metadata', origin).toString();
  }

  builder.hasContextLink(getContextLink);

  // hold data application
  app.set('ExpressDataApplication', serviceApplication);

  // use data middleware (register req.context)
  app.use(serviceApplication.middleware(app));

  app.use('/', indexRouter);

  // pass RSA private and public keys
  app.use('/auth/', authRouter(passport));

  app.use('/api/docs', docsRouter);

  app.use('/api/', (req, res, next) => {
     onHeaders(res, function() {
         if (!this.getHeader('OData-Version')) {
             this.setHeader('OData-Version', '4.0')
         }
     });
     return next();
  });

  app.get('/api/', (req, res, next) => {
        try {
            /**
             * @type {ODataModelBuilder}
             */
            const builder = req.context.getApplication().getService(ODataModelBuilder);
            // get edm document
            return builder.getEdm().then(result => {
                return res.json({
                    '@odata.context': getContextLink(req.context),
                    value: result.entityContainer.entitySet
                });
            }).catch(err => {
                return next(err);
            });
        } catch (err) {
            return next(err);
        }
    });


  app.get('/api/\\$metadata', getMetadataDocument());
  // use @themost/express service router
  // noinspection JSCheckFunctionSignatures
  app.use('/api/', (req, res, next) => {
    passport.authenticate(['bearer', 'anonymous'], { session: false }, (err, user) => {
      if (err) { return next(err); }
      if (!user) {
        return next(new HttpUnauthorizedError());
      }
      req.user = user;
      return next();
    })(req, res, next);
  }, serviceRouter);

  // catch 404 and forward to error handler
  app.use((_req, _res, next) => {
    next(createError(404));
  });
  // error handler
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err)
    }
    const isDevOrTest = req.app.get('env') === 'development' || req.app.get('env') === 'test';
    if (req.get('accept') === 'application/json') {
      // get error object
      const error = Object.getOwnPropertyNames(err).filter((key) => {
        return key !== 'stack' || (key === 'stack' && isDevOrTest);
      }).reduce((acc, key) => {
        acc[key] = err[key];
        return acc;
      }, {});
      const proto = Object.getPrototypeOf(err);
      if (proto && proto.constructor && proto.constructor.name) {
        error.name = proto.constructor.name;
      }
      // return error as json
      return res.status(err.status || err.statusCode || 500).json(error);
    }
    // set locals, only providing error in development
    res.locals = {
      message: err.message
    };
    if (isDevOrTest) {
      Object.assign(res.locals, {
        error: err
      });
    }
    // render the error page
    res.status(err.status || err.statusCode || 500);
    res.render('error');
  });

  process.on('exit', () => {
    if (testDatabase) {
      if (fs.existsSync(testDatabase)) {
        // cleanup process database
        fs.unlinkSync(testDatabase);
      }
    }
  });
  return app;
}

/**
 *
 * @param {import('express').Application} app
 * @returns {Promise<void>}
 */
async function finalizeApplication(app) {
  /**
   * @type {ExpressDataApplication}
   */
  const dataApplication = app.get('ExpressDataApplication');
  if (dataApplication) {
    const service = dataApplication.getConfiguration().getStrategy(DataCacheStrategy);
    if (typeof service.finalize === 'function') {
      await service.finalize();
    }
  }
}

export { getApplication, finalizeApplication };
