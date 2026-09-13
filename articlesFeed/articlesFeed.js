// main.js
import { ArticlesFeedModel } from './model.js';
import { ArticlesFeedView } from './view.js';
import { ArticlesFeedController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticlesFeedModel();
    const view = new ArticlesFeedView();
    new ArticlesFeedController(model, view);
});