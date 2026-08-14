import { startDeliveryCronJobs } from './delivery-jobs.js';

export const startWorkers = async () => {
  startDeliveryCronJobs();
};
