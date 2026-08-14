/**
 * Delivery Module Background Jobs.
 *
 * Runs scheduled interval jobs for:
 * 1. 10-Day Overdue Buyer Delivery Reminders
 * 2. SLA Breach & Impending Breach Monitoring
 */

import { deliveryService } from '../modules/delivery/delivery.service.js';

let isJobsRunning = false;

export const startDeliveryCronJobs = () => {
  if (isJobsRunning) return;
  isJobsRunning = true;

  console.log('[DeliveryJobs] Initializing background delivery cron jobs...');

  // Run initial checks 30 seconds after server startup
  setTimeout(async () => {
    try {
      const slaResult = await deliveryService.processSlaBreachMonitoring();
      console.log('[DeliveryJobs] SLA Monitoring check completed:', slaResult);

      const reminderResult = await deliveryService.processOverdue10DayBuyerReminders();
      console.log('[DeliveryJobs] 10-Day Buyer Reminder check completed:', reminderResult);
    } catch (err) {
      console.error('[DeliveryJobs] Initial check error:', err);
    }
  }, 30_000);

  // SLA Breach Monitoring: Runs every 1 hour (3,600,000 ms)
  setInterval(async () => {
    try {
      const res = await deliveryService.processSlaBreachMonitoring();
      if (res.breachedUpdated > 0 || res.impendingUpdated > 0) {
        console.log('[DeliveryJobs] SLA Breach check updated:', res);
      }
    } catch (err) {
      console.error('[DeliveryJobs] SLA Breach check error:', err);
    }
  }, 60 * 60 * 1000);

  // 10-Day Overdue Buyer Reminder: Runs every 12 hours (43,200,000 ms)
  setInterval(async () => {
    try {
      const res = await deliveryService.processOverdue10DayBuyerReminders();
      if (res.remindedCount > 0) {
        console.log('[DeliveryJobs] 10-Day Buyer Reminder check updated:', res);
      }
    } catch (err) {
      console.error('[DeliveryJobs] Buyer Reminder check error:', err);
    }
  }, 12 * 60 * 60 * 1000);
};
