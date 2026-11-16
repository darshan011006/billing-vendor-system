import { startLowStockListener } from './lowStockListener';
import { startRetryWorker } from './retryNotifications';

export function startWorkers() {
  startLowStockListener();
  startRetryWorker();
}
