
import { ArticlesManagementModel } from './model.js';
import { ArticlesManagementView } from './view.js';
import { ArticlesManagementController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new ArticlesManagementModel();
    if (!model.canAccess())
    {
        window.location.replace('../login/index.html');
        return;
    }
    const view = new ArticlesManagementView();
    new ArticlesManagementController(model, view);
});