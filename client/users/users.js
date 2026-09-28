import { UsersModel } from './model.js';
import { UsersView } from './view.js';
import { UsersController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new UsersModel();
    const view = new UsersView();
    new UsersController(model, view);
});
