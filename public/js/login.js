import { LoginModel } from 'models/login.js';
import { LoginView } from 'views/login.js';
import { LoginController } from 'controllers/login.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new LoginModel();
    const view = new LoginView();
    const controller = new LoginController(model, view);
});