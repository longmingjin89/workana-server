import { startMonitor } from './core/monitor.js';
import { logger } from './core/logger.js';

const once = process.argv.includes('--once');

async function main() {
  logger.info(`Workana Post Server starting (mode: ${once ? 'once' : 'auto'})`);

  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
  });

  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled rejection: ${err}`);
  });

  await startMonitor(once);
}

main().catch(err => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
