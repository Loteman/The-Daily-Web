import { ArticlesManagementModel } from './model.js';
import { ArticlesManagementView } from './view.js';
import { ArticlesManagementController } from './controller.js';

document.addEventListener('DOMContentLoaded', async () => {
    const model = new ArticlesManagementModel();
    const view = new ArticlesManagementView();
    try {
        if (!await model.initialize()) {
            window.location.replace('../login/index.html');
            return;
        }
        view.setCategories(model.categories);
        const controller = new ArticlesManagementController(model, view);
        await controller.ready;
    } catch (error) { console.log(error); }
});
