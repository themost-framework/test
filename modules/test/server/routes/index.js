import express from 'express';
let indexRouter = express.Router();

/* GET home page. */
indexRouter.get('/', (req, res) => {
  res.render('index', { title: 'test api server' });
});

indexRouter.get('/', (req, res) => {
  res.render('index', { title: 'test api server' });
});

export {indexRouter};
