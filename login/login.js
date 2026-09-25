import { LoginModel } from './model.js';
import { LoginView } from './view.js';
import { LoginController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new LoginModel();
    const view = new LoginView();
    const controller = new LoginController(model, view);
});