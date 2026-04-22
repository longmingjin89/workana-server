import { pool } from './db.js';
import type { ProjectDetail, ClientProfile } from '../types/project.js';
import { logger } from '../core/logger.js';

export async function projectExists(slug: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM projects WHERE slug=$1', [slug]);
  return res.rowCount! > 0;
}

export async function isClientScam(profileUrl: string): Promise<boolean> {
  const res = await pool.query('SELECT is_scam FROM clients WHERE profile_url=$1', [profileUrl]);
  if (res.rowCount === 0) return false;
  return res.rows[0].is_scam === true;
}

export async function upsertClient(profile: ClientProfile): Promise<void> {
  await pool.query(
    `INSERT INTO clients
       (profile_url, name, country_code, payment_verified, rating,
        projects_published, projects_paid, member_since, last_login, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (profile_url) DO UPDATE SET
       name=$2, country_code=$3, payment_verified=$4, rating=$5,
       projects_published=$6, projects_paid=$7, member_since=$8,
       last_login=$9, updated_at=NOW()`,
    [
      profile.profileUrl, profile.name, profile.countryCode,
      profile.paymentVerified, profile.rating,
      profile.projectsPublished, profile.projectsPaid,
      profile.memberSince, profile.lastLogin,
    ]
  );

  // Replace open jobs
  await pool.query('DELETE FROM client_jobs WHERE client_profile_url=$1', [profile.profileUrl]);
  for (const job of profile.openJobs) {
    await pool.query(
      `INSERT INTO client_jobs (client_profile_url, slug, title, url, budget, published_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (client_profile_url, slug) DO UPDATE SET
         title=$3, url=$4, budget=$5, published_at=$6, updated_at=NOW()`,
      [profile.profileUrl, job.slug, job.title, job.url, job.budget, job.publishedAt]
    );
  }

  // Upsert reviews
  for (const review of profile.reviews) {
    await pool.query(
      `INSERT INTO freelancer_reviews
         (client_profile_url, job_title, job_url, freelancer_name, freelancer_url,
          rating, comment, time_ago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (client_profile_url, job_url, freelancer_url) DO UPDATE SET
         job_title=$2, freelancer_name=$4, rating=$6, comment=$7,
         time_ago=$8, updated_at=NOW()`,
      [
        profile.profileUrl, review.jobTitle, review.jobUrl,
        review.freelancerName, review.freelancerUrl,
        review.rating, review.comment, review.timeAgo,
      ]
    );
  }
}

export async function saveProject(detail: ProjectDetail): Promise<void> {
  await pool.query(
    `INSERT INTO projects
       (slug, url, title, budget, full_description, category, subcategory,
        status, skills, published_at, client_profile_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (slug) DO NOTHING`,
    [
      detail.slug,
      detail.url,
      detail.title,
      detail.budget,
      detail.fullDescription,
      detail.category,
      detail.subcategory,
      detail.status,
      detail.skills,
      detail.publishedAt,
      detail.clientProfileUrl || null,
    ]
  );
}

export async function getSeenSlugs(): Promise<Set<string>> {
  const res = await pool.query('SELECT slug FROM projects');
  return new Set(res.rows.map((r: any) => r.slug));
}
