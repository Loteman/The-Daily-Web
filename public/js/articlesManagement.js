import { ArticlesManagementModel } from 'models/articlesManagement.js';
import { ArticlesManagementView } from 'views/articlesManagement.js';
import { ArticlesManagementController } from 'controllers/articlesManagement.js';

document.addEventListener('DOMContentLoaded', async () => {
    const model = new ArticlesManagementModel();
    const view = new ArticlesManagementView();
    try {
        if (!await model.initialize()) {
            window.location.replace('../public/login/index.html');
            return;
        }
        view.setCategories(model.categories);
        const controller = new ArticlesManagementController(model, view);
        await controller.ready;
    } catch (error) { console.log(error); }
});
