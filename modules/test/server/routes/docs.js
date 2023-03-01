import { HttpNotFoundError } from '@themost/common';
import { SchemaLoaderStrategy } from '@themost/data';
import express from 'express';
import path from 'path';
let docsRouter = express.Router();

function orderByName(a, b) {
  if (a.name > b.name) {
    return 1;
  }
  if (a.name < b.name) {
    return -1;
  }
  return 0;
}

/* GET home page. */
docsRouter.get('/', (req, res) => {
  return res.redirect(path.join(req.baseUrl, 'models'));
});
docsRouter.get('/models/:model', (req, res, next) => {
  const model = req.context.model(req.params.model);
  if (model == null) {
    return next(new HttpNotFoundError());
  }
  return res.render('model', {
    model: {
      name: model.name,
      implements: model.implements,
      inherits: model.inherits,
      attributes: model.attributes.sort(orderByName)
    }
  });
});
docsRouter.get('/models', (req, res) => {
  /**
   * @type {import('@themost/data').SchemaLoaderStrategy}
   */
  const schemaLoader = req.context.application.getConfiguration().getStrategy(SchemaLoaderStrategy);
  const models = schemaLoader.getModels().map((name) => {
    const model = schemaLoader.getModelDefinition(name);
    return {
      name: model.name,
      inherits: model.inherits,
      implements: model.implements
    }
  }).sort(orderByName);
  return res.render('models', {
    models
  });
});

export {docsRouter};
