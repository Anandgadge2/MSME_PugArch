import { startDeliveryCronJobs } from './delivery-jobs.js';
import { startDisputeCronJobs } from './dispute-jobs.js';
import { startAutoSuspensionCronJobs } from './auto-suspension.job.js';
import { startDataRetentionCronJobs } from './data-retention-purge.job.js';

export const startWorkers = async () => {
  startDeliveryCronJobs();
  startDisputeCronJobs();
  startAutoSuspensionCronJobs();
  startDataRetentionCronJobs();
};
