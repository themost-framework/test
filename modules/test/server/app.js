
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
import { DataCacheStrategy } from "@themost/data";

function getApplication() {
  const config = require('./config/app.json');
  // prepare temp database
  const findAdapter = config.adapters.find(adapter => {
    return adapter.name === 'test';
  });
  let testDatabase;
  if (findAdapter) {
    // get temp database path
    testDatabase = temp.path('.db');
    // copy database to temp path
    fs.copyFileSync(path.resolve(__dirname, 'db/local.db'), testDatabase);
    // update database path
    findAdapter.options.database = testDatabase;
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
  const dataApplication = new ExpressDataApplication(path.resolve(__dirname, 'config'));

  if (dataApplication.hasService(Authenticator) === false) {
    dataApplication.useService(Authenticator);
  }

  // hold data application
  app.set('ExpressDataApplication', dataApplication);

  // use data middleware (register req.context)
  app.use(dataApplication.middleware());

  app.use('/', indexRouter);

  // pass RSA private and public keys
  app.use('/auth/', authRouter(passport));

  app.use('/api/docs', docsRouter);

  app.get('/api/\\$metadata', getMetadataDocument());
  // use @themost/express service router
  // noinspection JSCheckFunctionSignatures
  app.use('/api/', (req, res, next) => {
    passport.authenticate('bearer', { session: false }, (err, user) => {
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
