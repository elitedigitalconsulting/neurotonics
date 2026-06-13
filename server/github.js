'use strict';

/**
 * server/github.js
 *
 * GitHub API helpers for the Neurotonics CMS:
 *
 * - commitContentFile(): writes an updated content file into the main site
 *   repository so the next Pages rebuild picks up the latest JSON.
 *
 * - ensureDataRepo() / getDataRepoFile() / putDataRepoFile():
 *   Manages a PRIVATE GitHub repository used as persistent storage for CMS
 *   data (stockist applications, users, settings).  The server automatically
 *   creates this repo on first run and backs up data to it after every write.
 *   On startup, if the SQLite database is empty (e.g. after a Render redeploy),
 *   the server fetches the latest backup from this repo and restores all data
 *   — with zero manual intervention.
 *
 *   Default data repo: {GITHUB_OWNER}/{GITHUB_REPO}-cms-data  (private)
 *   Override:          GITHUB_DATA_REPO env var (format: owner/repo)
 *
 * - triggerRebuild(): dispatches a `cms-content-update` repository_dispatch
 *   event that runs the CMS rebuild workflow and redeploys GitHub Pages.
 *
 * Requires:
 *   GITHUB_PAT   — Personal Access Token with `repo` scope (read/write + create repos)
 *   GITHUB_OWNER — repository owner (default: elitedigitalconsulting)
 *   GITHUB_REPO  — repository name  (default: neurotonics)
 */

const https = require('https');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'elitedigitalconsulting';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'neurotonics';

// ---------------------------------------------------------------------------
// Data repo coordinates — private repo used for persistent CMS backups.
// ---------------------------------------------------------------------------
function getDataRepoCoords() {
  const configured = (process.env.GITHUB_DATA_REPO || '').trim();
  if (configured && configured.includes('/')) {
    const slash = configured.indexOf('/');
    return {
      owner: configured.slice(0, slash),
      repo:  configured.slice(slash + 1),
      full:  configured,
    };
  }
  const repo = `${GITHUB_REPO}-cms-data`;
  return { owner: GITHUB_OWNER, repo, full: `${GITHUB_OWNER}/${repo}` };
}

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

/**
 * Make a POST request to the GitHub API with a JSON body.
 */
function githubPost(apiPath, body, pat) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     apiPath,
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
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        } else {
          reject(new Error(`GitHub POST ${apiPath} failed: HTTP ${res.statusCode} — ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Data repo operations — used for persistent CMS backup storage
// ---------------------------------------------------------------------------

let _dataRepoReady = false;

/**
 * Ensures the private data repository exists, creating it if needed.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Failure is non-fatal: the server continues with file-based backup only.
 */
async function ensureDataRepo() {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return;

  const { owner, repo, full } = getDataRepoCoords();

  // Check if it already exists
  try {
    await githubGet(`/repos/${full}`, pat);
    _dataRepoReady = true;
    console.log(`[github] Data repo ${full} is ready.`);
    return;
  } catch (err) {
    if (err.statusCode !== 404) {
      console.warn(`[github] Could not check data repo ${full}: ${err.message}`);
      return;
    }
  }

  // Create it as a private repo under the owner's account
  console.log(`[github] Creating private data repo: ${full}`);
  try {
    const body = JSON.stringify({
      name:        repo,
      private:     true,
      description: `Neurotonics CMS data — auto-created by ${GITHUB_REPO} server`,
      auto_init:   true,
    });
    // Use /user/repos if owner matches token owner; otherwise /orgs/:org/repos
    const createPath = `/user/repos`;
    await githubPost(createPath, body, pat);
    _dataRepoReady = true;
    console.log(`[github] Private data repo created: ${full}`);
  } catch (err) {
    console.warn(`[github] Could not create data repo (will use file-only backup): ${err.message}`);
  }
}

/**
 * Reads a file from the data repo.
 * Returns the UTF-8 decoded file content, or null if not found.
 */
async function getDataRepoFile(filePath) {
  const pat = process.env.GITHUB_PAT;
  if (!pat || !_dataRepoReady) return null;

  const { full } = getDataRepoCoords();
  const encoded  = filePath.split('/').map(encodeURIComponent).join('/');

  try {
    const info = await githubGet(`/repos/${full}/contents/${encoded}`, pat);
    if (!info.content) return null;
    return Buffer.from(info.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch (err) {
    if (err.statusCode === 404) return null;
    console.error(`[github] getDataRepoFile(${filePath}) error:`, err.message);
    return null;
  }
}

/**
 * Creates or updates a file in the data repo.
 * @param {string} filePath   — path within the data repo (e.g. 'backup/latest.json')
 * @param {string} utf8Content — file content
 * @param {string} [message]  — commit message
 */
async function putDataRepoFile(filePath, utf8Content, message) {
  const pat = process.env.GITHUB_PAT;
  if (!pat || !_dataRepoReady) return;

  const { full }   = getDataRepoCoords();
  const encoded    = filePath.split('/').map(encodeURIComponent).join('/');
  const apiPath    = `/repos/${full}/contents/${encoded}`;
  const commitMsg  = message || `backup: update ${filePath} [skip ci]`;

  // Fetch current SHA (needed to update an existing file)
  let currentSha;
  try {
    const info = await githubGet(apiPath, pat);
    currentSha = info.sha;
  } catch (err) {
    if (err.statusCode !== 404) {
      console.error(`[github] putDataRepoFile SHA fetch error: ${err.message}`);
      return;
    }
  }

  const body = JSON.stringify({
    message: commitMsg,
    content: Buffer.from(utf8Content, 'utf8').toString('base64'),
    ...(currentSha ? { sha: currentSha } : {}),
  });

  await githubPut(apiPath, body, pat);
}

/**
 * Returns true if the data repo is confirmed reachable.
 */
function isDataRepoReady() {
  return _dataRepoReady;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Commits an updated content file directly to the GitHub repository using the
 * Git Contents API.  This ensures the file is up-to-date in git before the
 * rebuild workflow checks out the repo.
 *
 * The commit message includes `[skip ci]` so that the push does not trigger
 * the normal `deploy.yml` workflow (which would also redeploy the Render
 * server unnecessarily).  The dedicated `cms-rebuild.yml` workflow is
 * triggered separately via `triggerRebuild()`.
 *
 * @param {string} repoFilePath - Path within the repo (e.g. 'src/content/product.json')
 * @param {string} utf8Content  - Full file content as a UTF-8 string
 * @param {string} [message]    - Optional commit message override
 * @returns {Promise<void>}
 */
async function commitContentFile(repoFilePath, utf8Content, message) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    console.warn('[github] GITHUB_PAT not set — skipping content commit to GitHub.');
    return;
  }

  const commitMessage = message || `chore(cms): update ${repoFilePath} [skip ci]`;
  const encodedPath   = repoFilePath.split('/').map(encodeURIComponent).join('/');
  const apiPath       = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;

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
    content: Buffer.from(utf8Content, 'utf8').toString('base64'),
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

module.exports = {
  commitContentFile,
  triggerRebuild,
  ensureDataRepo,
  getDataRepoFile,
  putDataRepoFile,
  isDataRepoReady,
  getDataRepoCoords,
};
