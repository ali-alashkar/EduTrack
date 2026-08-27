const { ipcMain, shell, app } = require('electron');
const https = require('https');
const path = require('path');

const GITHUB_REPO = 'ali-alashkar/EduTrack';

/**
 * Compare two semver version strings (e.g. "1.0.0" and "1.1.0" or "v1.2.0")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const clean1 = String(v1).replace(/^v/i, '').trim();
  const clean2 = String(v2).replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Fetch latest release metadata from GitHub API
 */
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'EduTrack-App-Updater',
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      // Handle redirects if any
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return https.get(res.headers.location, { headers: options.headers }, (redRes) => {
          let redData = '';
          redRes.on('data', chunk => { redData += chunk; });
          redRes.on('end', () => {
            try {
              resolve(JSON.parse(redData));
            } catch (err) {
              reject(new Error('Invalid response from server'));
            }
          });
        }).on('error', reject);
      }

      if (res.statusCode === 404) {
        return resolve({ notFound: true });
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API responded with status ${res.statusCode}`));
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse release information'));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Update check request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

function registerUpdaterHandlers() {
  ipcMain.handle('updates:check', async () => {
    let currentVersion = '1.0.0';
    try {
      const pkg = require('../../package.json');
      currentVersion = pkg.version || app.getVersion() || '1.0.0';
    } catch (_) {
      currentVersion = app.getVersion() || '1.0.0';
    }

    try {
      const release = await fetchLatestRelease();

      if (!release || release.notFound || !release.tag_name) {
        return {
          success: true,
          updateAvailable: false,
          currentVersion,
          message: 'No published releases found yet on GitHub repository.',
        };
      }

      const rawTagName = release.tag_name || release.name || '';
      const latestVersion = rawTagName.replace(/^v/i, '').trim();

      const isNewer = compareVersions(latestVersion, currentVersion) > 0;

      // Find direct download link for .exe or fallback to release page
      let downloadUrl = release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
      if (Array.isArray(release.assets) && release.assets.length > 0) {
        const exeAsset = release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        } else if (release.assets[0].browser_download_url) {
          downloadUrl = release.assets[0].browser_download_url;
        }
      }

      return {
        success: true,
        updateAvailable: isNewer,
        currentVersion,
        latestVersion,
        releaseName: release.name || `Version ${latestVersion}`,
        releaseNotes: release.body || '',
        publishedAt: release.published_at || '',
        downloadUrl,
        htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      };
    } catch (err) {
      console.warn('[Updater] Could not check for updates:', err.message);
      return {
        success: false,
        updateAvailable: false,
        currentVersion,
        error: err.message,
      };
    }
  });

  ipcMain.handle('updates:open-download', async (_, url) => {
    if (!url || typeof url !== 'string') {
      url = `https://github.com/${GITHUB_REPO}/releases/latest`;
    }
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = registerUpdaterHandlers;
module.exports.compareVersions = compareVersions;
