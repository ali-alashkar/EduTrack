// ════════════════════════════════════════════════════════════════════════════
// EduTrack — Universal Searchable Select Component
// Transforms every standard HTML <select> into a searchable dropdown menu.
// ════════════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function enhanceSearchableSelect(selectEl) {
    if (!selectEl || selectEl.dataset.searchable === 'true' || selectEl.dataset.searchable === 'false') return;

    selectEl.dataset.searchable = 'true';

    // Create wrapper
    const wrap = document.createElement('div');
    wrap.className = 'searchable-select-wrap';
    
    // Copy layout dimensions & styles from original select
    if (selectEl.style.width) wrap.style.width = selectEl.style.width;
    if (selectEl.style.flex) wrap.style.flex = selectEl.style.flex;
    if (selectEl.style.maxWidth) wrap.style.maxWidth = selectEl.style.maxWidth;
    if (selectEl.style.minWidth) wrap.style.minWidth = selectEl.style.minWidth;
    if (selectEl.disabled) wrap.classList.add('disabled');

    // Preserve initial inline display (if any) before hiding original select
    if (selectEl.style.display !== 'none') {
      selectEl.dataset.originalDisplay = selectEl.style.display;
    }
    const origDisplay = selectEl.dataset.originalDisplay || '';

    let isUpdatingStyle = false;

    function syncVisibilityFromSelect() {
      if (isUpdatingStyle) return;
      isUpdatingStyle = true;

      const isHiddenAttr = selectEl.hidden || selectEl.classList.contains('hidden');

      if (!isHiddenAttr) {
        wrap.style.display = origDisplay;
      } else {
        wrap.style.display = 'none';
      }
      selectEl.style.display = 'none';

      isUpdatingStyle = false;
    }

    // Initial visibility sync & hide original select
    syncVisibilityFromSelect();

    // Insert wrapper in DOM
    selectEl.parentNode.insertBefore(wrap, selectEl.nextSibling);

    // Create trigger button
    const trigger = document.createElement('div');
    trigger.className = 'searchable-select-trigger';
    trigger.tabIndex = selectEl.disabled ? -1 : 0;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'searchable-select-label';

    const arrowIcon = document.createElement('div');
    arrowIcon.className = 'searchable-select-arrow';
    arrowIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="6 9 12 15 18 9"/></svg>`;

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowIcon);
    wrap.appendChild(trigger);

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown hidden';

    // Create search input header
    const searchWrap = document.createElement('div');
    searchWrap.className = 'searchable-select-search-wrap';
    searchWrap.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="searchable-select-search-icon">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'searchable-select-input';
    searchInput.placeholder = 'Search options…';
    searchInput.autocomplete = 'off';

    searchWrap.appendChild(searchInput);
    dropdown.appendChild(searchWrap);

    // Create options list
    const optionsList = document.createElement('ul');
    optionsList.className = 'searchable-select-options';
    dropdown.appendChild(optionsList);

    wrap.appendChild(dropdown);

    // Function to populate option items from selectEl
    function syncOptions() {
      optionsList.innerHTML = '';
      const options = Array.from(selectEl.options);

      if (options.length === 0) {
        labelSpan.textContent = '— No options —';
        return;
      }

      const selectedOption = selectEl.options[selectEl.selectedIndex] || options[0];
      labelSpan.textContent = selectedOption ? selectedOption.text : 'Select…';

      options.forEach((opt) => {
        const li = document.createElement('li');
        li.className = 'searchable-select-option';
        if (opt.selected) li.classList.add('selected');
        if (opt.disabled) li.classList.add('disabled');
        li.dataset.value = opt.value;
        li.textContent = opt.text;

        li.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opt.disabled) return;
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          selectEl.dispatchEvent(new Event('input', { bubbles: true }));
          updateSelectedUI();
          closeDropdown();
        });

        optionsList.appendChild(li);
      });
    }

    function updateSelectedUI() {
      const selectedOption = selectEl.options[selectEl.selectedIndex];
      labelSpan.textContent = selectedOption ? selectedOption.text : 'Select…';
      Array.from(optionsList.children).forEach((li) => {
        li.classList.toggle('selected', li.dataset.value === selectEl.value);
      });
      if (selectEl.disabled) {
        wrap.classList.add('disabled');
        trigger.tabIndex = -1;
      } else {
        wrap.classList.remove('disabled');
        trigger.tabIndex = 0;
      }
    }

    function filterOptions(query) {
      const q = query.toLowerCase().trim();
      let matchCount = 0;
      Array.from(optionsList.children).forEach((li) => {
        const text = li.textContent.toLowerCase();
        const matches = text.includes(q);
        li.style.display = matches ? '' : 'none';
        if (matches) matchCount++;
      });

      let noResults = dropdown.querySelector('.searchable-select-no-results');
      if (matchCount === 0) {
        if (!noResults) {
          noResults = document.createElement('div');
          noResults.className = 'searchable-select-no-results';
          noResults.textContent = 'No matching options';
          dropdown.appendChild(noResults);
        }
        noResults.style.display = '';
      } else if (noResults) {
        noResults.style.display = 'none';
      }
    }

    function openDropdown() {
      if (selectEl.disabled) return;

      // Close all other open searchable select dropdowns
      document.querySelectorAll('.searchable-select-dropdown:not(.hidden)').forEach(d => {
        if (d !== dropdown) {
          d.classList.add('hidden');
          const parentWrap = d.closest('.searchable-select-wrap');
          if (parentWrap) parentWrap.classList.remove('open');
        }
      });

      dropdown.classList.remove('hidden');
      wrap.classList.add('open');
      searchInput.value = '';
      filterOptions('');

      // Auto-focus search input
      setTimeout(() => searchInput.focus(), 40);
    }

    function closeDropdown() {
      dropdown.classList.add('hidden');
      wrap.classList.remove('open');
    }

    // Toggle on trigger click or Enter/Space key
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('hidden')) {
        openDropdown();
      } else {
        closeDropdown();
      }
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
    });

    // Handle search input events
    searchInput.addEventListener('input', debounce((e) => {
      filterOptions(e.target.value);
    }, 100));

    searchInput.addEventListener('click', (e) => e.stopPropagation());

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        trigger.focus();
      }
    });

    // Sync when value on selectEl changes programmatically
    selectEl.addEventListener('change', () => {
      updateSelectedUI();
    });

    // Override disabled property setter to update UI immediately
    const origDisabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');
    if (origDisabledDesc && origDisabledDesc.set) {
      try {
        Object.defineProperty(selectEl, 'disabled', {
          get() {
            return origDisabledDesc.get.call(this);
          },
          set(val) {
            origDisabledDesc.set.call(this, val);
            if (val) {
              this.setAttribute('disabled', '');
            } else {
              this.removeAttribute('disabled');
            }
            updateSelectedUI();
          },
          configurable: true
        });
      } catch (_) {}
    }

    // Observe changes to select options, attributes, and styles
    const observer = new MutationObserver((mutations) => {
      let childChanged = false;
      let attrChanged = false;
      for (const m of mutations) {
        if (m.type === 'childList') childChanged = true;
        if (m.type === 'attributes') attrChanged = true;
      }
      if (childChanged) syncOptions();
      if (attrChanged) {
        updateSelectedUI();
        syncVisibilityFromSelect();
      }
    });
    observer.observe(selectEl, { childList: true, subtree: true, attributes: true });

    // Initial sync
    syncOptions();

    // Attach helper method on select element
    selectEl._syncSearchableSelect = function() {
      syncOptions();
      updateSelectedUI();
    };
  }

  // Scan root container for unenhanced selects
  function initSearchableSelects(root = document) {
    const selects = root.querySelectorAll('select:not([data-searchable="true"])');
    selects.forEach(enhanceSearchableSelect);
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.searchable-select-wrap')) {
      document.querySelectorAll('.searchable-select-dropdown:not(.hidden)').forEach(d => {
        d.classList.add('hidden');
        const wrap = d.closest('.searchable-select-wrap');
        if (wrap) wrap.classList.remove('open');
      });
    }
  });

  // MutationObserver for auto-enhancing dynamically inserted selects
  const bodyObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      initSearchableSelects();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initSearchableSelects();
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  });

  // Global Exports
  window.enhanceSearchableSelect = enhanceSearchableSelect;
  window.initSearchableSelects = initSearchableSelects;

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initSearchableSelects();
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
