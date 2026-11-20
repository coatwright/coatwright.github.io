/*
 * Coatwright cloud backup & sync: merging this device's data with the copy saved in the painter's account.
 * Pure functions (tested in Node); the app does the network calls.
 *
 * Rules, so nothing is ever lost or overwritten blindly:
 *   • Jobs: the most recently changed copy of each job wins (syncAt: stamped by the app on every change).
 *   • Expenses: kept from both sides (matched by id).
 *   • Deleted jobs/expenses are remembered ("tombstones") so they don't come back from another device.
 *   • Settings: the most recently changed settings win, except device-only fields (sign-in, subscription status…).
 */
(function (global) {
  'use strict';

  /** Settings that belong to this device/account session and are never synced. */
  var LOCAL_ONLY = ['account', 'sub', 'comp', 'trialStart', 'trialReminder', 'installHintDismissed', 'lastBackup'];

  function syncedSettings(settings) {
    var out = {};
    Object.keys(settings || {}).forEach(function (k) { if (LOCAL_ONLY.indexOf(k) === -1) out[k] = settings[k]; });
    return out;
  }

  /** Stable text form, used to tell whether anything changed. */
  function stable(x) {
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(x[k]); }).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }

  function hash(x) {
    var s = stable(x), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0) + ':' + s.length;
  }

  function mergeTombstones(a, b) {
    var out = { jobs: {}, expenses: {} };
    [a || {}, b || {}].forEach(function (t) {
      ['jobs', 'expenses'].forEach(function (kind) {
        var src = t[kind] || {};
        Object.keys(src).forEach(function (id) { out[kind][id] = Math.max(out[kind][id] || 0, Number(src[id]) || 0); });
      });
    });
    return out;
  }

  function changedAt(item) {
    if (!item) return 0;
    return Math.max(Number(item.syncAt) || 0, Number(item.updatedAt) || 0, Number(item.createdAt) || 0);
  }

  /** Content fingerprint of a job/expense, ignoring the sync stamp (used to notice edits). */
  function itemHash(item) {
    var c = {};
    Object.keys(item || {}).forEach(function (k) { if (k !== 'syncAt') c[k] = item[k]; });
    return hash(c);
  }

  function mergeList(local, remote, dead, keepNewer) {
    var byId = {}, order = [];
    function take(item) {
      if (!item || !item.id) return;
      var cur = byId[item.id];
      if (!cur) { byId[item.id] = item; order.push(item.id); return; }
      if (!keepNewer) return;
      var a = changedAt(item), b = changedAt(cur);
      // Newer wins; on an exact tie pick the same copy on every device so they agree.
      if (a > b || (a === b && stable(item) > stable(cur))) byId[item.id] = item;
    }
    (local || []).forEach(take);
    (remote || []).forEach(take);
    return order.map(function (id) { return byId[id]; }).filter(function (item) {
      var d = dead[item.id];
      return !d || changedAt(item) > d; // edited after it was deleted elsewhere → keep
    });
  }

  /**
   * Merge this device's data with the account's saved copy.
   * local/remote: { settings, settingsAt, jobs, expenses, deleted: {jobs:{id:ts}, expenses:{id:ts}} } (remote may be null)
   * Returns { doc: what to save in the account, settings: synced settings for this device, jobs, expenses, deleted,
   *           settingsAt, changedLocal, changedRemote }
   */
  function merge(local, remote) {
    local = local || {};
    var r = remote || { settings: null, settingsAt: 0, jobs: [], expenses: [], deleted: {} };
    var deleted = mergeTombstones(local.deleted, r.deleted);
    var jobs = mergeList(local.jobs, r.jobs, deleted.jobs, true)
      .sort(function (a, b) { return changedAt(b) - changedAt(a); });
    var expenses = mergeList(local.expenses, r.expenses, deleted.expenses, true);
    var useRemoteSettings = r.settings && (Number(r.settingsAt) || 0) > (Number(local.settingsAt) || 0);
    var settings = syncedSettings(useRemoteSettings ? r.settings : local.settings);
    var settingsAt = Math.max(Number(local.settingsAt) || 0, Number(r.settingsAt) || 0);
    var doc = { v: 1, settings: settings, settingsAt: settingsAt, jobs: jobs, expenses: expenses, deleted: deleted };
    var byId = function (list) { return (list || []).slice().sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; }); };
    var localView = { settings: syncedSettings(local.settings), jobs: byId(local.jobs), expenses: byId(local.expenses), deleted: mergeTombstones(local.deleted) };
    var mergedView = { settings: settings, jobs: byId(jobs), expenses: byId(expenses), deleted: deleted };
    return {
      doc: doc, settings: settings, settingsAt: settingsAt, jobs: jobs, expenses: expenses, deleted: deleted,
      changedLocal: stable(localView) !== stable(mergedView),
      changedRemote: !remote || stable({ settings: syncedSettings(r.settings), settingsAt: Number(r.settingsAt) || 0, jobs: byId(r.jobs), expenses: byId(r.expenses), deleted: mergeTombstones(r.deleted) }) !==
        stable({ settings: settings, settingsAt: settingsAt, jobs: byId(jobs), expenses: byId(expenses), deleted: deleted })
    };
  }

  /** Forget tombstones older than ~6 months so the list doesn't grow forever. */
  function pruneTombstones(deleted, now) {
    var cutoff = (now || Date.now()) - 183 * 864e5, out = { jobs: {}, expenses: {} };
    ['jobs', 'expenses'].forEach(function (kind) {
      Object.keys((deleted || {})[kind] || {}).forEach(function (id) { if (deleted[kind][id] > cutoff) out[kind][id] = deleted[kind][id]; });
    });
    return out;
  }

  var api = { LOCAL_ONLY: LOCAL_ONLY, syncedSettings: syncedSettings, hash: hash, itemHash: itemHash, changedAt: changedAt, merge: merge, pruneTombstones: pruneTombstones, stable: stable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.CloudSync = api;
})(typeof window !== 'undefined' ? window : this);
