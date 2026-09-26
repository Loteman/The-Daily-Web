// main.js
import { ArticlesFeedModel } from './models/articleFeedModel.js';
import { ArticlesFeedView } from './views/articleFeedView.js';
import { ArticlesFeedController } from './controllers/articleFeedController.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticlesFeedModel();
    const view = new ArticlesFeedView();
    new ArticlesFeedController(model, view);
});