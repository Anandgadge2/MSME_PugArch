import { startDeliveryCronJobs } from './delivery-jobs.js';
import { startDisputeCronJobs } from './dispute-jobs.js';

export const startWorkers = async () => {
  startDeliveryCronJobs();
  startDisputeCronJobs();
};
