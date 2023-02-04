
import express from 'express';
import {ViewEngine} from '@themost/ejs';
import path from 'path';
import passport from 'passport';
import {authRouter} from './routes/auth';
// eslint-disable-next-line no-unused-vars
import { ExpressDataApplication, serviceRouter, dateReviver, ExpressDataContext } from '@themost/express';
import {indexRouter} from './routes/index';
import temp from 'temp';
import fs from 'fs';
import cors from 'cors';

function getApplication() {
  const config = require('./config/app.json');
// prepare temp database
  const findAdapter = config.adapters.find( adapter => {
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
app.use(cors({ origin:true, credentials: true }));


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
// hold data application
  app.set('ExpressDataApplication', dataApplication);

// use data middleware (register req.context)
  app.use(dataApplication.middleware());

  app.use('/', indexRouter);

  // pass RSA private and public keys
  app.use('/auth/', authRouter({
    privateKey: path.resolve(__dirname, 'config', 'private.key'),
    publicKey: path.resolve(__dirname, 'config', 'public.pem')
  }));

// use @themost/express service router
// noinspection JSCheckFunctionSignatures
  app.use('/api/', passport.authenticate('bearer', { session: false }), serviceRouter);

// error handler
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err)
    }
    // set locals, only providing error in development
    res.locals = {
      message: err.message,
      error: req.app.get('env') === 'development' ? err : { }
    };
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

export {getApplication};
