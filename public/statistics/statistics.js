import { StatisticsModel } from './model.js';
import { StatisticsView } from './view.js';
import { StatisticsController } from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new StatisticsModel();
    const view = new StatisticsView();
    new StatisticsController(model, view);
});
