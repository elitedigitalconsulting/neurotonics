'use strict';

/**
 * server/github.js
 *
 * GitHub API helpers for the Neurotonics CMS:
 *
 * - commitContentFile(): writes an updated content file directly into the
 *   GitHub repository via the Contents API so that the next rebuild picks up
 *   the latest JSON (not the stale copy that was present at the time the
 *   Render service was last deployed).
 *
 * - triggerRebuild(): dispatches a `cms-content-update` repository_dispatch
 *   event that runs the CMS rebuild workflow and redeploys GitHub Pages.
 *
 * Requires:
 *   GITHUB_PAT   — Personal Access Token with `repo` scope (contents: write)
 *   GITHUB_OWNER — repository owner (default: elitedigitalconsulting)
 *   GITHUB_REPO  — repository name  (default: neurotonics)
 */

const https = require('https');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'elitedigitalconsulting';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'neurotonics';

// ---------------------------------------------------------------------------
// Low-level HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Make a GET request to the GitHub API and return the parsed JSON body.
 * Rejects with an error that includes the HTTP status for non-2xx responses.
 */
function githubGet(apiPath, pat) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     apiPath,
      method:   'GET',
      headers: {
        'Accept':               'application/vnd.github+json',
        'Authorization':        `Bearer ${pat}`,
        'User-Agent':           'neurotonics-cms/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        } else {
          const err = new Error(`GitHub GET ${apiPath} failed: HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Make a PUT request to the GitHub API with a JSON body.
 * Resolves with the parsed response body on success (2xx).
 */
function githubPut(apiPath, body, pat) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     apiPath,
      method:   'PUT',
      headers: {
        'Accept':               'application/vnd.github+json',
        'Authorization':        `Bearer ${pat}`,
        'Content-Type':         'application/json',
        'Content-Length':       Buffer.byteLength(body),
        'User-Agent':           'neurotonics-cms/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        } else {
          reject(new Error(`GitHub PUT ${apiPath} failed: HTTP ${res.statusCode} — ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Commits a file directly to the GitHub repository using the Git Contents API.
 * Works for both text files (UTF-8 strings) and binary files (Buffer / base64
 * strings).  Ensures the file is up-to-date in git before the rebuild workflow
 * checks out the repo.
 *
 * The commit message includes `[skip ci]` so that the push does not trigger
 * the normal `deploy.yml` workflow (which would also redeploy the Render
 * server unnecessarily).  The dedicated `cms-rebuild.yml` workflow is
 * triggered separately via `triggerRebuild()`.
 *
 * @param {string}          repoFilePath - Path within the repo (e.g. 'src/content/product.json')
 * @param {string|Buffer}   content      - File content: UTF-8 string, pre-encoded base64 string,
 *                                         or a raw Buffer (all are base64-encoded for the API)
 * @param {string}          [message]    - Optional commit message override
 * @returns {Promise<void>}
 */
async function commitContentFile(repoFilePath, content, message) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    console.warn('[github] GITHUB_PAT not set — skipping content commit to GitHub.');
    return;
  }

  const commitMessage = message || `chore(cms): update ${repoFilePath} [skip ci]`;
  const encodedPath   = repoFilePath.split('/').map(encodeURIComponent).join('/');
  const apiPath       = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;

  // Normalise content to a base64 string for the GitHub API.
  // - Buffer  → convert directly (binary-safe)
  // - string  → treat as UTF-8 and encode
  const base64Content = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content, 'utf8').toString('base64');

  // Retrieve the current file's blob SHA — required by the API to update an
  // existing file.  A 404 means the file is new; proceed without a SHA.
  let currentSha;
  try {
    const fileInfo = await githubGet(apiPath, pat);
    currentSha = fileInfo.sha;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    // New file — no SHA needed
  }

  const body = JSON.stringify({
    message: commitMessage,
    content: base64Content,
    ...(currentSha ? { sha: currentSha } : {}),
  });

  await githubPut(apiPath, body, pat);
  console.log(`[github] Committed ${repoFilePath} to ${GITHUB_OWNER}/${GITHUB_REPO}.`);
}

/**
 * Dispatches a `cms-content-update` repository_dispatch event to trigger the
 * CMS rebuild workflow, which rebuilds and redeploys the GitHub Pages site.
 *
 * Call this *after* `commitContentFile()` so the checkout in the workflow
 * always sees the latest content.
 *
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
        'Accept':               'application/vnd.github+json',
        'Authorization':        `Bearer ${pat}`,
        'Content-Type':         'application/json',
        'Content-Length':       Buffer.byteLength(body),
        'User-Agent':           'neurotonics-cms/1.0',
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

module.exports = { commitContentFile, triggerRebuild };
