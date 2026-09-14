import { ArticleModel } from './model.js';
import { ArticleView } from './view.js';
import { ArticleController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticleModel();
    const view = new ArticleView();
    new ArticleController(model, view);
});