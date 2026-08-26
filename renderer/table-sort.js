/**
 * table-sort.js
 * Global table sorting utility — works on ANY <table> in the app.
 *
 * Usage: just add data-sortable="true" to any <thead><th> you want sortable,
 *        OR it auto-activates on all th cells that don't contain interactive
 *        elements (buttons, inputs, checkboxes).
 *
 * The sort is purely client-side (operates on rendered DOM rows).
 * Columns tagged with data-nosort="true" are skipped.
 */
(function () {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Extract a comparable value from a table cell */
  function getCellValue(tr, colIdx) {
    const td = tr.children[colIdx];
    if (!td) return '';

    // Prefer data-sort attribute for custom sort keys
    if (td.dataset.sort !== undefined) return td.dataset.sort;

    // Strip HTML tags and normalise whitespace
    return td.innerText.trim();
  }

  /**
   * Compare two cell values, auto-detecting type.
   * Order: numeric → date (DD/MM/YYYY or YYYY-MM-DD) → locale string
   */
  function compareValues(a, b) {
    // Numeric
    const na = parseFloat(a.replace(/[^0-9.\-]/g, ''));
    const nb = parseFloat(b.replace(/[^0-9.\-]/g, ''));
    if (!isNaN(na) && !isNaN(nb)) return na - nb;

    // Date patterns: DD/MM/YYYY or YYYY-MM-DD
    const da = parseDate(a);
    const db = parseDate(b);
    if (da && db) return da - db;

    // Locale string comparison
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  }

  function parseDate(str) {
    // DD/MM/YYYY
    const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
    // YYYY-MM-DD
    const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return new Date(str);
    return null;
  }

  // ── Core sort logic ──────────────────────────────────────────────────────────

  function sortTable(table, th, colIdx) {
    const thead = th.closest('thead');
    const allTh = thead.querySelectorAll('th.sortable-col');

    // Toggle direction
    const isAsc = th.dataset.sortDir !== 'asc';
    th.dataset.sortDir = isAsc ? 'asc' : 'desc';

    // Reset other columns
    allTh.forEach(t => {
      if (t !== th) delete t.dataset.sortDir;
      t.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.toggle('sort-asc', isAsc);
    th.classList.toggle('sort-desc', !isAsc);

    // Collect all sortable tbody rows (skip fixed/summary rows tagged data-nosort)
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr:not([data-nosort])'));
    if (rows.length === 0) return;

    rows.sort((a, b) => {
      const av = getCellValue(a, colIdx);
      const bv = getCellValue(b, colIdx);
      const cmp = compareValues(av, bv);
      return isAsc ? cmp : -cmp;
    });

    // Re-append in sorted order (fixed rows stay at end)
    rows.forEach(r => tbody.appendChild(r));
  }

  // ── Auto-activation via MutationObserver ─────────────────────────────────────

  /**
   * Activate sorting on a table that hasn't been set up yet.
   * We mark the table with data-sort-init="true" to avoid double-init.
   */
  function activateTable(table) {
    if (table.dataset.sortInit) return;
    table.dataset.sortInit = 'true';

    const thead = table.querySelector('thead');
    if (!thead) return;

    const headerRow = thead.querySelector('tr');
    if (!headerRow) return;

    Array.from(headerRow.children).forEach((th, colIdx) => {
      // Skip columns explicitly marked as non-sortable
      if (th.dataset.nosort === 'true') return;

      // Skip if the cell contains interactive elements (buttons, inputs, links)
      const hasInteractive = th.querySelector('button, input, select, a');
      if (hasInteractive) return;

      // Skip cells with no text content (icon-only cells)
      if (!th.innerText.trim()) return;

      th.classList.add('sortable-col');
      th.title = 'Click to sort';
      th.addEventListener('click', () => sortTable(table, th, colIdx));
    });
  }

  /** Scan the whole document for uninitialized tables */
  function scanTables() {
    document.querySelectorAll('table').forEach(activateTable);
  }

  // Run once on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanTables);
  } else {
    scanTables();
  }

  // Watch for dynamically added tables (pages render content into the DOM)
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        // The added node itself might be a table
        if (node.tagName === 'TABLE') activateTable(node);
        // Or it might contain tables
        node.querySelectorAll && node.querySelectorAll('table').forEach(activateTable);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Re-scan when navigation triggers a page render
  // (Pages overwrite innerHTML, so new tables appear as added nodes — the
  //  MutationObserver above already handles this, but expose a manual trigger
  //  in case it's needed.)
  window.initTableSort = scanTables;
})();
