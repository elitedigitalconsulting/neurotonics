'use strict';

/**
 * server/github.js
 *
 * Triggers a GitHub Actions `repository_dispatch` event of type
 * `cms-content-update`, which causes the CMS rebuild workflow to run,
 * rebuilding and redeploying the GitHub Pages static site.
 *
 * Requires:
 *   GITHUB_PAT   — Personal Access Token with `repo` scope
 *   GITHUB_OWNER — repository owner (default: elitedigitalconsulting)
 *   GITHUB_REPO  — repository name  (default: neurotonics)
 */

const https = require('https');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'elitedigitalconsulting';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'neurotonics';

/**
 * Dispatch a repository_dispatch event to trigger a GitHub Pages rebuild.
 * @param {object} [clientPayload={}] — extra data passed to the workflow
 * @returns {Promise<void>}
 */
async function triggerRebuild(clientPayload = {}) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    console.warn('[github] GITHUB_PAT not set — skipping rebuild trigger.');
    return;
  }

  const body = JSON.stringify({
    event_type: 'cms-content-update',
    client_payload: clientPayload,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      method:   'POST',
      headers: {
        'Accept':        'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'neurotonics-cms/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, (res) => {
      // GitHub returns 204 No Content on success
      if (res.statusCode === 204) {
        console.log('[github] Rebuild triggered successfully.');
        resolve();
      } else {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.error(`[github] Rebuild trigger failed: HTTP ${res.statusCode} — ${data}`);
          reject(new Error(`GitHub dispatch failed with status ${res.statusCode}`));
        });
      }
    });

    req.on('error', (err) => {
      console.error('[github] Rebuild trigger request error:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { triggerRebuild };
