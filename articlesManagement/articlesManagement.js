
import { ArticlesManagementModel } from './model.js';
import { ArticlesManagementView } from './view.js';
import { ArticlesManagementController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticlesManagementModel();
    const view = new ArticlesManagementView();
    new ArticlesManagementController(model, view);
});