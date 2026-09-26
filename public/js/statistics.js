import { StatisticsModel } from 'models/statistics.js';
import { StatisticsView } from 'views/statistics.js';
import { StatisticsController } from 'controllers/statistics.js';

document.addEventListener('DOMContentLoaded', () => {
    const model = new StatisticsModel();
    const view = new StatisticsView();
    new StatisticsController(model, view);
});
