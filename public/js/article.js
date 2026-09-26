import { ArticleModel } from 'models/articleModel.js';
import { ArticleView } from 'views/articleView.js';
import { ArticleController } from 'controllers/articleController.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticleModel();
    const view = new ArticleView();
    new ArticleController(model, view);
});