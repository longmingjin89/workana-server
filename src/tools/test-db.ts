import '../core/config.js';
import { initDb, pool } from '../storage/db.js';
import { launchBrowser, closeBrowser } from '../browser/engine.js';
import { fetchClientProfile } from '../scraper/client.js';
import { upsertClient, isClientScam } from '../storage/repository.js';
import { logger } from '../core/logger.js';

const TEST_PROFILE = '/e/d99599574bb02250434c2f714cff60ea';

async function main() {
  logger.info('Testing full DB integration...');
  await initDb();

  const { page: _ } = await launchBrowser(false);

  try {
    // Fetch and save client
    const profile = await fetchClientProfile(TEST_PROFILE);
    if (!profile) throw new Error('Client profile fetch returned null');

    await upsertClient(profile);
    logger.info('Client upserted successfully');

    // Verify in DB
    const clientRow = await pool.query('SELECT * FROM clients WHERE profile_url=$1', [TEST_PROFILE]);
    logger.info('DB client: ' + JSON.stringify(clientRow.rows[0], null, 2));

    const jobsRow = await pool.query('SELECT count(*) FROM client_jobs WHERE client_profile_url=$1', [TEST_PROFILE]);
    logger.info(`DB client_jobs count: ${jobsRow.rows[0].count}`);

    const reviewsRow = await pool.query('SELECT count(*) FROM freelancer_reviews WHERE client_profile_url=$1', [TEST_PROFILE]);
    logger.info(`DB freelancer_reviews count: ${reviewsRow.rows[0].count}`);

    // Test is_scam check
    const scam = await isClientScam(TEST_PROFILE);
    logger.info(`is_scam: ${scam}`);

    logger.info('Integration test passed');
  } catch (err) {
    logger.error(`Test failed: ${err}`);
  } finally {
    await closeBrowser();
    await pool.end();
  }
}

main();
