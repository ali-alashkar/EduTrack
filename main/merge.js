/**
 * merge.js
 * Smart merge engine for concurrent editing conflict resolution.
 *
 * Strategy: "Latest-write wins" per record, keyed by record ID.
 *   - A record only in local  -> keep it
 *   - A record only in remote -> keep it
 *   - Same ID on both        -> keep the one with the later timestamp field
 *   - Tie (equal timestamps) -> keep local (no conflict logged)
 *
 * No network calls. Pure data transformation.
 */

// ── Per-collection merge config ────────────────────────────────────────────────
// ts: the field used to determine which version is newer
// fb: secondary field if ts is absent
const MERGEABLE = {
  users:         { ts: 'updatedAt',   fb: 'createdAt'   },
  students:      { ts: 'updatedAt',   fb: 'createdAt'   },
  groups:        { ts: 'updatedAt',   fb: 'createdAt'   },
  sessions:      { ts: 'updatedAt',   fb: 'createdAt'   },
  attendance:    { ts: 'updatedAt',   fb: 'checkInTime' },
  payments:      { ts: 'createdAt',   fb: 'createdAt'   },
  quiz_scores:   { ts: 'recordedAt',  fb: 'recordedAt'  },
  expenses:      { ts: 'updatedAt',   fb: 'createdAt'   },
  levels:        { ts: 'updatedAt',   fb: 'createdAt'   },
  centers:       { ts: 'updatedAt',   fb: 'createdAt'   },
  block_history: { ts: 'timestamp',   fb: 'timestamp'   },
  audit_log:     { ts: 'timestamp',   fb: 'timestamp'   },
  whatsapp_log:  { ts: 'sentAt',      fb: 'createdAt'   },
  books_sales:   { ts: 'createdAt',   fb: 'createdAt'   },
  deleted_records: { ts: 'deletedAt', fb: 'deletedAt'  },
};

// These are device-local config - never overwrite from remote
const LOCAL_ONLY = new Set([
  'sync_settings',
  'backup_settings',
  'whatsapp_settings',
  'whatsapp_templates',
  'system',
]);

// Auto-prune old entries from high-volume append-only collections
const PRUNE_DAYS = 30;
const PRUNE_DAYS_TOMBSTONES = 90;
const PRUNE_COLLECTIONS = new Set(['audit_log', 'whatsapp_log', 'block_history']);

function pruneOldEntries(arr, ts, fb, days = PRUNE_DAYS) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return (Array.isArray(arr) ? arr : []).filter(r => {
    if (!r) return false;
    const t = r[ts] || r[fb] || '';
    return t >= cutoff;
  });
}

// ── Attendance deduplication ──────────────────────────────────────────────────
/**
 * After a standard ID-based merge, attendance can still contain duplicate
 * records for the same (sessionId, studentId) pair — this happens when two
 * devices scan the same student at the same time before syncing.
 *
 * Strategy: keep the record with the earliest checkInTime; collect the IDs
 * of the discarded duplicates so they can be tombstoned.
 *
 * @returns {{ deduped: Array, removedIds: string[] }}
 */
function deduplicateAttendance(merged) {
  const seen = new Map(); // key: "sessionId:studentId" → winning record
  const removedIds = [];

  for (const rec of merged) {
    if (!rec || !rec.id || !rec.sessionId || !rec.studentId) continue;
    const key = `${rec.sessionId}:${rec.studentId}`;
    if (!seen.has(key)) {
      seen.set(key, rec);
    } else {
      const existing = seen.get(key);
      // Keep the earlier check-in; drop the later one
      if ((rec.checkInTime || '') < (existing.checkInTime || '')) {
        removedIds.push(existing.id);
        seen.set(key, rec);
      } else {
        removedIds.push(rec.id);
      }
    }
  }

  return { deduped: [...seen.values()], removedIds };
}

// ── Quiz Scores deduplication ──────────────────────────────────────────────────
function deduplicateQuizScores(merged) {
  const seen = new Map(); // key: "sessionId:studentId" → winning record
  const removedIds = [];

  for (const rec of merged) {
    if (!rec || !rec.id || !rec.sessionId || !rec.studentId) continue;
    const key = `${rec.sessionId}:${rec.studentId}`;
    if (!seen.has(key)) {
      seen.set(key, rec);
    } else {
      const existing = seen.get(key);
      // Keep the latest score update
      if ((rec.recordedAt || '') > (existing.recordedAt || '')) {
        removedIds.push(existing.id);
        seen.set(key, rec);
      } else {
        removedIds.push(rec.id);
      }
    }
  }

  return { deduped: [...seen.values()], removedIds };
}

/**
 * Merges two arrays of records by ID.
 * Returns { merged, conflicts }
 *   conflicts: [{ dbName, recordId, winner, localTs, remoteTs, resolvedAt }]
 */
function mergeCollection(localArr, remoteArr, { ts, fb }, dbName) {
  const conflicts = [];
  if (!Array.isArray(localArr))  localArr  = [];
  if (!Array.isArray(remoteArr)) remoteArr = [];

  // Build map from local records
  const map = new Map();
  for (const r of localArr) {
    if (r && r.id) map.set(r.id, r);
  }

  // Merge in remote records
  for (const remote of remoteArr) {
    if (!remote || !remote.id) continue;

    if (!map.has(remote.id)) {
      // New record that only exists on remote device — add it
      map.set(remote.id, remote);
    } else {
      // Same ID on both devices — latest timestamp wins
      const local    = map.get(remote.id);
      const localTs  = local[ts]  || local[fb]  || '';
      const remoteTs = remote[ts] || remote[fb] || '';

      if (remoteTs > localTs) {
        // Remote is newer — remote wins
        map.set(remote.id, remote);
        conflicts.push({
          dbName,
          recordId:   remote.id,
          winner:     'remote',
          localTs,
          remoteTs,
          resolvedAt: new Date().toISOString(),
        });
      } else if (localTs > remoteTs) {
        // Local is newer — local stays (log it for audit trail)
        conflicts.push({
          dbName,
          recordId:   local.id,
          winner:     'local',
          localTs,
          remoteTs,
          resolvedAt: new Date().toISOString(),
        });
      }
      // Equal timestamps — local stays silently, no conflict logged
    }
  }

  let merged = [...map.values()];

  // Prune entries older than 30 days from log-style collections (90 days for tombstones)
  if (dbName === 'deleted_records') {
    merged = pruneOldEntries(merged, 'deletedAt', 'deletedAt', PRUNE_DAYS_TOMBSTONES);
  } else if (PRUNE_COLLECTIONS.has(dbName)) {
    merged = pruneOldEntries(merged, ts, fb, PRUNE_DAYS);
  }

  // De-duplicate attendance and quiz_scores by (sessionId, studentId) — handles the race condition
  // where two devices scan/add the same student before the first sync completes.
  let duplicateIds = [];
  if (dbName === 'attendance') {
    const { deduped, removedIds } = deduplicateAttendance(merged);
    if (removedIds.length > 0) {
      console.log(`[Merge] Removed ${removedIds.length} duplicate attendance record(s):`, removedIds);
      duplicateIds = removedIds;
      merged = deduped;
    }
  } else if (dbName === 'quiz_scores') {
    const { deduped, removedIds } = deduplicateQuizScores(merged);
    if (removedIds.length > 0) {
      console.log(`[Merge] Removed ${removedIds.length} duplicate quiz score record(s):`, removedIds);
      duplicateIds = removedIds;
      merged = deduped;
    }
  }

  return { merged, conflicts, duplicateIds };
}

// ── Full snapshot merge ────────────────────────────────────────────────────────
/**
 * Merges all databases in two full snapshots (local vs remote Drive snapshot).
 *
 * @param {Object} localDbs  - { dbName: Array } from local files
 * @param {Object} remoteDbs - { dbName: Array } from Drive snapshot
 * @returns {{ mergedDbs, allConflicts, localNeedsUpdate }}
 *   localNeedsUpdate = true when remote had records that local didn't,
 *   meaning we must write merged data back to local files before uploading.
 */
function mergeSnapshots(localDbs, remoteDbs) {
  const mergedDbs    = {};
  const allConflicts = [];
  let   localNeedsUpdate = false;

  // 1. First merge deletion tombstones (deleted_records)
  const localTombstones  = Array.isArray(localDbs?.deleted_records)  ? localDbs.deleted_records  : [];
  const remoteTombstones = Array.isArray(remoteDbs?.deleted_records) ? remoteDbs.deleted_records : [];
  const { merged: mergedTombstones } = mergeCollection(
    localTombstones,
    remoteTombstones,
    MERGEABLE.deleted_records,
    'deleted_records'
  );
  mergedDbs.deleted_records = mergedTombstones;

  const localTombstoneKeys = new Set(localTombstones.map(t => (t && t.dbName && t.id) ? `${t.dbName}:${t.id}` : '').filter(Boolean));
  const hasNewTombstones = mergedTombstones.some(t => t && t.dbName && t.id && !localTombstoneKeys.has(`${t.dbName}:${t.id}`));
  if (hasNewTombstones) {
    localNeedsUpdate = true;
  }

  // Build tombstone set: "dbName:id"
  const tombstoneSet = new Set();
  for (const t of mergedTombstones) {
    if (t && t.dbName && t.id) {
      tombstoneSet.add(`${t.dbName}:${t.id}`);
    }
  }

  const allKeys = new Set([
    ...Object.keys(localDbs  || {}),
    ...Object.keys(remoteDbs || {}),
  ]);

  for (const dbName of allKeys) {
    if (dbName === 'deleted_records') continue;

    // Device-local config: local always wins, never merge from remote
    if (LOCAL_ONLY.has(dbName)) {
      mergedDbs[dbName] = localDbs[dbName] !== undefined
        ? localDbs[dbName]
        : remoteDbs[dbName];
      continue;
    }

    // Key-value object database (session_payment_status)
    if (dbName === 'session_payment_status') {
      const localMap = (localDbs[dbName] && typeof localDbs[dbName] === 'object' && !Array.isArray(localDbs[dbName])) ? localDbs[dbName] : {};
      const remoteMap = (remoteDbs[dbName] && typeof remoteDbs[dbName] === 'object' && !Array.isArray(remoteDbs[dbName])) ? remoteDbs[dbName] : {};
      const mergedObj = { ...localMap };
      for (const [k, remoteVal] of Object.entries(remoteMap)) {
        if (!mergedObj[k]) {
          mergedObj[k] = remoteVal;
          localNeedsUpdate = true;
        } else {
          const localVal = mergedObj[k];
          if ((remoteVal?.updatedAt || '') > (localVal?.updatedAt || '')) {
            mergedObj[k] = remoteVal;
            localNeedsUpdate = true;
          }
        }
      }
      mergedDbs[dbName] = mergedObj;
      continue;
    }

    const config     = MERGEABLE[dbName];
    let   localData  = Array.isArray(localDbs[dbName])  ? localDbs[dbName]  : localDbs[dbName];
    let   remoteData = Array.isArray(remoteDbs[dbName]) ? remoteDbs[dbName] : remoteDbs[dbName];

    // Filter out records deleted by tombstones
    if (Array.isArray(localData)) {
      const origCount = localData.length;
      localData = localData.filter(r => r && r.id && !tombstoneSet.has(`${dbName}:${r.id}`));
      if (localData.length < origCount) {
        localNeedsUpdate = true;
      }
    }
    if (Array.isArray(remoteData)) {
      remoteData = remoteData.filter(r => r && r.id && !tombstoneSet.has(`${dbName}:${r.id}`));
    }

    // Unknown or non-array collection: local wins
    if (!config || (!Array.isArray(localData) && !Array.isArray(remoteData))) {
      mergedDbs[dbName] = localData !== undefined ? localData : remoteData;
      continue;
    }

    const { merged, conflicts, duplicateIds = [] } = mergeCollection(localData, remoteData, config, dbName);
    mergedDbs[dbName] = merged;
    allConflicts.push(...conflicts);

    // Auto-tombstone duplicates so the deduplication propagates to all devices
    if (duplicateIds.length > 0) {
      const now = new Date().toISOString();
      for (const dupId of duplicateIds) {
        const key = `${dbName}:${dupId}`;
        if (!tombstoneSet.has(key)) {
          mergedDbs.deleted_records.push({ id: dupId, dbName, deletedAt: now });
          tombstoneSet.add(key);
        }
      }
      localNeedsUpdate = true;
    }

    // Detect whether local data needs to be updated with remote additions
    const localIds  = new Set((Array.isArray(localData)  ? localData  : []).map(r => r && r.id).filter(Boolean));
    const remoteIds = new Set((Array.isArray(remoteData) ? remoteData : []).map(r => r && r.id).filter(Boolean));

    const hasNewFromRemote = [...remoteIds].some(id => !localIds.has(id));
    const hasRemoteWinners = conflicts.some(c => c.winner === 'remote');

    if (hasNewFromRemote || hasRemoteWinners) localNeedsUpdate = true;
  }

  return { mergedDbs, allConflicts, localNeedsUpdate };
}

module.exports = { mergeSnapshots, mergeCollection };
