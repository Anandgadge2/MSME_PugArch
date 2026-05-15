import { startServer } from '../index.js';

startServer().catch(error => {
  console.error('Critical error:', error);
  process.exit(1);
});
