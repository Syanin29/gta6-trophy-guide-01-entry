// GTA VI Trophy Guide - Offline Static Web App
// Features: filters, spoilers, earned tracking, roadmap, stats, export/import, demo mode

const API_BASE = 'data/trophies.json';
const STORAGE_KEY = 'gta6-trophy-progress';
const DEMO_KEY = 'gta6-trophy-progress-demo';

// Trophy data
let allTrophies = [];
let originalTrophies = [];
let roadmapData = [];;
let currentFilters = {
  search: '',
  grade: 'all',
  kind: 'all',
  status: 'all',
  missable: false,
  spoilers: true
};

// DOM elements
const rowsElement = null; // Will be set after DOM load
let guideUrlParam = null;
let progressEl = null;
let gradeSelect = null;
let searchInput = null;
let missableToggle = null;
let spoilerToggle = null;
let exportBtn = null;
let importInput = null;
let resetBtn = null;
let trophyGrid = null;
let roadmapSection = null;
let statsSection = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM elements
  trophyGrid = document.querySelector('.trophy-grid');
  progressEl = document.getElementById('progress');
  gradeSelect = document.getElementById('grade');
  searchInput = document.getElementById('search');
  missableToggle = document.getElementById('missable');
  spoilerToggle = document.getElementById('spoilers');
  exportBtn = document.getElementById('export');
  importInput = document.querySelector('.import input');
  resetBtn = document.getElementById('reset');
  
  roadmapSection = document.getElementById('roadmap-section');
  statsSection = document.getElementById('stats-section');
  
  // Load trophy data
  loadTrophies();
  
  // Load progress
  loadProgress();
  
  // Render initial view
  render();
  
  // Set up event listeners
  setupEventListeners();
  
  // Handle URL hash/views
});

// Load trophy data from JSON
async function loadTrophies() {
  try {
    const response = await fetch(API_BASE);
    const data = await response.json(); allTrophies = data.trophies || data;
    roadmapData = data.roadmap || [];
    originalTrophies = JSON.parse(JSON.stringify(allTrophies)); // deep copy
    // Initialize progress for any trophies not in localStorage
    const earnedSet = getEarnedSet();
    allTrophies.forEach(t => {
      if (!earnedSet.has(t.name)) {
        t._earned = false;
      }
    });
    render();
    handleViewHash();
  } catch (error) {
    console.error('Failed to load trophies:', error);
  }
}

// Get earned trophy names from localStorage
function getEarnedSet() {
  try {
    const key = document.body.classList.contains('demo-mode') ? DEMO_KEY : STORAGE_KEY;
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    return new Set();
  }
}

// Load progress from localStorage (real or demo)
function loadProgress() {
  const demoMode = document.body.classList.contains('demo-mode');
  const key = demoMode ? DEMO_KEY : STORAGE_KEY;
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    return new Set();
  }
}

// Save progress to localStorage
function saveProgress(earnedSet, key) {
  try {
    localStorage.setItem(key, JSON.stringify([...earnedSet]));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Grade filter
  gradeSelect.addEventListener('change', (e) => {
    currentFilters.grade = e.target.value;
    render();
  });
  
  // Search input
  searchInput.addEventListener('input', (e) => {
    currentFilters.search = e.target.value.toLowerCase();
    render();
  });
  
  // Missable toggle
  missableToggle.addEventListener('change', (e) => {
    currentFilters.missable = e.target.checked;
    render();
  });
  
  // Spoiler toggle
  spoilerToggle.addEventListener('change', (e) => {
    currentFilters.spoilers = e.target.checked;
    render();
  });
  
  // Export progress
  exportBtn.addEventListener('click', () => {
    const earnedSet = getEarnedSet();
    const blob = new Blob([JSON.stringify([...earnedSet])], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trophy-progress.json';
    a.click();
  });
  
  // Import progress
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = new Set(JSON.parse(text));
      // Validate that imported names exist in our trophy list
      const validImport = new Set([...imported].filter(name => 
        allTrophies.some(t => t.name === name)
      ));
      saveProgress(validImport, DEMO_KEY); // Save to demo key for import demo
      // Also update real progress if not in demo mode
      if (!document.body.classList.contains('demo-mode')) {
        saveProgress(validImport, STORAGE_KEY);
      }
      render();
    } catch (err) {
      alert('Invalid JSON file');
    }
  });
  
  // Reset progress
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEMO_KEY);
      // Reset all trophy earned states
      allTrophies.forEach(t => delete t._earned);
      render();
    }
  });
  
  // Window hash/state handling
  window.addEventListener('hashchange', handleViewHash);
}

// Render all trophies with current filters
function render() {
  const earnedSet = getEarnedSet();
  const demoMode = document.body.classList.contains('demo-mode');
  
  // Filter trophies
  let filtered = [...allTrophies];
  
  // Search filter
  if (currentFilters.search) {
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(currentFilters.search) ||
      t.description.toLowerCase().includes(currentFilters.search) ||
      t.guide.toLowerCase().includes(currentFilters.search)
    );
  }
  
  // Grade filter
  if (currentFilters.grade !== 'all') {
    filtered = filtered.filter(t => t.grade === currentFilters.grade);
  }
  
  // Kind filter
  if (currentFilters.kind !== 'all') {
    filtered = filtered.filter(t => t.kind === currentFilters.kind);
  }
  
  // Status filter (all/earned/missing)
  if (currentFilters.status === 'earned') {
    filtered = filtered.filter(t => earnedSet.has(t.name));
  } else if (currentFilters.status === 'missing') {
    filtered = filtered.filter(t => !earnedSet.has(t.name));
  }
  
  // Missable filter
  if (currentFilters.missable) {
    filtered = filtered.filter(t => t.missable);
  }
  
  // Render trophy grid
  renderTrophyGrid(filtered, earnedSet, demoMode);
  
  // Expand guide for matching trophy from URL param
  if (guideUrlParam) {
    const matchingTrophy = allTrophies.find(t =>
      (t.id && String(t.id) === guideUrlParam) ||
      t.name.toLowerCase().includes(guideUrlParam.toLowerCase())
    );
    if (matchingTrophy) {
      const guideSections = document.querySelectorAll('.guide-section');
      guideSections.forEach(section => {
        const prev = section.previousElementSibling;
        if (prev && prev.querySelector('.name')) {
          const nameText = prev.querySelector('.name').textContent;
          if (nameText === matchingTrophy.name) {
            section.style.display = 'block';
            section.innerHTML = `<h4>How to Get It</h4><p>${matchingTrophy.guide}</p><p class="tip">${matchingTrophy.tip}</p><p class="meta">Difficulty: ${matchingTrophy.difficulty}/5 · Time: ${matchingTrophy.time} · Roadmap phase: ${matchingTrophy.step}</p>${matchingTrophy.missable && matchingTrophy.missibleNote ? `<p class="missable-warning">⚠ Missable: ${matchingTrophy.missibleNote}</p>` : ""}</p><p class="sources">Sources: ${matchingTrophy.sources.map(s => `<a href="${s}" target="_blank">${s}</a>`).join(' ')}</p>`;
            section.scrollIntoView({ behavior: 'instant', block: 'nearest' });
          }
        }
      });
    }
  }
  // Update progress display
  updateProgressDisplay(earnedSet);
  
  // Render roadmap (if viewing roadmap)
  if (window.location.hash === '#roadmap' || (document.body.classList.contains('demo-mode') && getUrlParam('view') === 'roadmap')) {
    renderRoadmap(earnedSet);
  }
  
  // Render stats (if viewing stats)
  if (window.location.hash === '#stats' || (document.body.classList.contains('demo-mode') && getUrlParam('view') === 'stats')) {
    renderStats(earnedSet);
  }
}

// Render trophy grid
function renderTrophyGrid(trophies, earnedSet, demoMode) {
  if (!trophyGrid) return;
  // Clear grid
  trophyGrid.innerHTML = '';
  
  // Count earned/missing for filtered set
  const earnedCount = trophies.filter(t => earnedSet.has(t.name)).length;
  const missingCount = trophies.length - earnedCount;
  
  // Progress bar text
  const total = trophies.length;
  const percent = Math.round((earnedCount / total) * 100);
  
  // Add each trophy card
  trophies.forEach(trophy => {
    // Skip hidden trophies when spoilers are on
    if (!currentFilters.spoilers && trophy.hidden) {
      // Show placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'trophy-card';
      placeholder.innerHTML = '<div class="grade-badge">Hidden</div><div class="name">Hidden trophy</div><div class="description">Complete the trophy to see details</div>';
      trophyGrid.appendChild(placeholder);
      return;
    }
    
    const isEarned = earnedSet.has(trophy.name);
    const isMissable = trophy.missable;
    
    const card = document.createElement('div');
    card.className = 'trophy-card' + (isEarned ? ' earned' : '');
    
    // Earned checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEarned;
    checkbox.dataset.trophyName = trophy.name;
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        earnedSet.add(trophy.name);
      } else {
        earnedSet.delete(trophy.name);
      }
      saveProgress(earnedSet, demoMode ? DEMO_KEY : STORAGE_KEY);
      render(); // Re-render to update state
    });
    
    // Grade badge
    const gradeBadge = document.createElement('span');
    gradeBadge.className = 'grade-badge';
    gradeBadge.textContent = trophy.grade[0].toUpperCase() + trophy.grade.slice(1);
    
    // Kind tag
    const kindTag = document.createElement('span');
    kindTag.className = 'kind-tag';
    kindTag.textContent = trophy.kind[0].toUpperCase() + trophy.kind.slice(1);
    
    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = trophy.name;
    
    // Description
    const descEl = document.createElement('div');
    descEl.className = 'description';
    descEl.textContent = trophy.description;
    
    // Count progress stepper (for counted trophies)
    const countSection = document.createElement('div');
    countSection.className = 'count-stepper';
    if (trophy.count !== null) {
      const earnedCountVal = earnedSet.has(trophy.name) ? trophy.count : 0;
      countSection.innerHTML = `
        <div>Progress: ${earnedCountVal}/${trophy.count}</div>
        <button class="step-btn decrease" data-trophy="${trophy.id}">-</button>
        <input type="number" value="${earnedCountVal}" min="0" max="${trophy.count}" data-trophy="${trophy.id}" class="step-input">
        <button class="step-btn increase" data-trophy="${trophy.id}">+</button>
      `;
      // Stepper controls
      const decreaseBtn = countSection.querySelector('.decrease');
      const increaseBtn = countSection.querySelector('.increase');
      const stepInput = countSection.querySelector('.step-input');
      
      decreaseBtn.addEventListener('click', () => {
        let val = parseInt(stepInput.value);
        if (val > 0) {
          val--;
          stepInput.value = val;
          // Note: we don't track individual count progress beyond the trophy count field
        }
      });
      
      increaseBtn.addEventListener('click', () => {
        let val = parseInt(stepInput.value);
        if (val < trophy.count) {
          val++;
          stepInput.value = val;
        }
      });
      
      stepInput.addEventListener('change', () => {
        let val = parseInt(stepInput.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > trophy.count) val = trophy.count;
        stepInput.value = val;
      });
    } else {
      countSection.textContent = '—';
    }
    
    // Missable flag
    const missableFlag = document.createElement('span');
    missableFlag.className = 'missable-flag';
    if (isMissable) {
      missableFlag.textContent = 'Missable';
    }
    
    // Guide section (expandable)
    const guideSection = document.createElement('div');
    guideSection.className = 'guide-section';
    
    // Determine if we should show guide based on spoilers
    const showGuide = currentFilters.spoilers || !trophy.hidden;
    
    if (showGuide) {
      guideSection.innerHTML = `
        <h4>How to Get It</h4>
        <p>${trophy.guide}</p>
        <p class="tip">${trophy.tip}</p>
        <p class="meta">Difficulty: ${trophy.difficulty}/5 · Time: ${trophy.time} · Roadmap phase: ${trophy.step}</p>${trophy.missable && trophy.missibleNote ? `<p class="missable-warning">⚠ Missable: ${trophy.missibleNote}</p>` : ""}</p>
        <p class="sources">Sources: ${trophy.sources.map(s => `<a href="${s}" target="_blank">${s}</a>`).join(' ')}</p>
      `;
    } else {
      guideSection.innerHTML = '<h4>Hidden Trophy</h4><p>Earn this trophy to reveal its guide.</p>';
    }
    
    // Card cells
    const cells = [
      checkbox,
      `${trophy.name}\n${trophy.description}`,
      gradeBadge.outerHTML + kindTag.outerHTML,
      trophy.grade
    ];
    
    // Build card HTML
    card.innerHTML = `
      <div class=" earned-status">${checkbox.outerHTML}</div>
      <div class="trophy-info">
        <div class="name">${trophy.name}</div>
        ${descEl.outerHTML}
        ${countSection.outerHTML}
        ${missableFlag.outerHTML}
      </div>
      <div class="grade-kind">${gradeBadge.outerHTML}${kindTag.outerHTML}</div>
    `;
    
    // Append guide after card insertion
    trophyGrid.appendChild(card);
    trophyGrid.appendChild(guideSection);
  });
  
  // Update progress bar
  if (progressEl) { progressEl.textContent = `${earnedCount} of ${total} earned (${percent}%)`; }
}

// Update progress display
function updateProgressDisplay(earnedSet) {
  const total = allTrophies.length;
  const earnedCount = [...earnedSet].length;
  const percent = Math.round((earnedCount / total) * 100);
  if (progressEl) { progressEl.textContent = `${earnedCount} of ${total} earned (${percent}%)`; }
  
  // Update grade breakdown chips
  updateGradeChips(earnedSet);
}

// Update grade breakdown chips
function updateGradeChips(earnedSet) {
  const gradeCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const kindCounts = {};
  
  earnedSet.forEach(name => {
    const t = allTrophies.find(t => t.name === name);
    if (t) {
      gradeCounts[t.grade]++;
      kindCounts[t.kind] = (kindCounts[t.kind] || 0) + 1;
    }
  });
  
  // Update the controls area - add grade breakdown
  const controls = document.querySelector('.controls');
  let gradeHtml = '';
  for (const [grade, count] of Object.entries(gradeCounts)) {
    const gradeName = grade[0].toUpperCase() + grade.slice(1);
    gradeHtml += `<span style="background: var(--bg-card); border: 1px var(--border); color: var(--fg-primary); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin: 2px;">${gradeName}: ${count}</span>`;
  }
  
  // Replace grade chip in controls
  const existingGradeChip = controls.querySelector('.grade-chip');
  if (existingGradeChip) {
    existingGradeChip.innerHTML = gradeHtml;
  }
}

// Render roadmap section
// Render roadmap section — data-driven from data.roadmap (5 platinum phases)
function renderRoadmap(earnedSet) {
  if (!roadmapSection) return;

  const byId = {};
  allTrophies.forEach(t => { byId[t.id] = t; });

  let phasesHtml = '';
  roadmapData.forEach(phase => {
    const ids = phase.trophyIds || [];
    const earnedInPhase = ids.filter(id => byId[id] && earnedSet.has(byId[id].name)).length;
    const pct = ids.length ? Math.round((earnedInPhase / ids.length) * 100) : 0;
    const rows = ids.map(id => {
      const t = byId[id];
      if (!t) return '';
      const earned = earnedSet.has(t.name);
      const miss = t.missable ? ' <span class="missable-badge">MISSABLE</span>' : '';
      return `<div class="roadmap-row${earned ? ' earned' : ''}"><span class="grade-chip grade-${t.grade}">${t.grade}</span> ${t.name}${miss}</div>`;
    }).join('');
    const warnings = (phase.missableWarnings || []).map(w => `<div class="missable-warning">⚠ ${w}</div>`).join('');
    phasesHtml += `
      <div class="phase-card">
        <h3><span class="step-num">${phase.phase}</span> ${phase.title}</h3>
        <p class="phase-goal">${phase.goal}</p>
        <div class="phase-progress"><div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div><span>${earnedInPhase}/${ids.length} earned</span></div>
        ${warnings}
        <div class="roadmap-rows">${rows}</div>
        <p class="phase-notes">${phase.notes || ''}</p>
      </div>`;
  });

  roadmapSection.innerHTML = `
    <h2>Platinum Roadmap — 5 Phases, 55 Trophies</h2>
    <p class="roadmap-intro">Work the phases in order. Missable trophies are flagged in every phase — grab them before moving on, or recover them later via mission replay / New Game+.</p>
    <div class="roadmap-phases">${phasesHtml}</div>
  `;
}// Handle URL hash/views
function handleViewHash() {
  const hash = window.location.hash;
  const demoMode = document.body.classList.contains('demo-mode');
  const viewParam = getUrlParam('view');
  const gradeParam = getUrlParam('grade');
  const kindParam = getUrlParam('kind');
  const spoilersParam = getUrlParam('spoilers');
  const guideParam = getUrlParam('guide');
  guideUrlParam = guideParam;
  
  // Update spoiler filter from URL
  if (spoilersParam !== null) {
    currentFilters.spoilers = spoilersParam === 'on';
    document.getElementById('spoilers').checked = currentFilters.spoilers;
  }
  
  // Update grade filter from URL
  if (gradeParam !== null) {
    gradeSelect.value = gradeParam;
    currentFilters.grade = gradeParam;
  }
  
  // Update kind filter from URL
  if (kindParam !== null) {
    document.querySelector(`[value="${kindParam}"]`).selected = true;
    currentFilters.kind = kindParam;
  }
  
  // View-based routing
  if (hash === '#roadmap' || viewParam === 'roadmap') {
    document.querySelectorAll('.view-button').forEach(b => b.classList.remove('active'));
    trophyGrid.style.display = 'none';
    roadmapSection.style.display = 'block';
    statsSection.style.display = 'none';
  } else if (hash === '#stats' || viewParam === 'stats') {
    document.querySelectorAll('.view-button').forEach(b => b.classList.remove('active'));
    trophyGrid.style.display = 'none';
    roadmapSection.style.display = 'none';
    statsSection.style.display = 'block';
  } else {
    // Default view: show trophy grid
    trophyGrid.style.display = 'grid';
    roadmapSection.style.display = 'none';
    statsSection.style.display = 'none';
    // Update filter buttons
    document.querySelectorAll('.view-button').forEach(b => b.classList.remove('active'));
  }
}

// Get URL parameter value
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Demo mode initialization
function initDemoMode() {
  const demoParam = getUrlParam('demo');
  if (demoParam === '1') {
    document.body.classList.add('demo-mode');
    // Set up demo progress: ~18 earned trophies + some counts
    const demoEarned = new Set([
      'Vice Got a Price!',
      'Just Like Paradise',
      'Paradise Lost',
      'Trust',
      'Break the Bank',
      'Family Matters',
      'DWNFALL',
      'Hi-Jacked',
      'Snow Storm',
      'You Gotta Know When to Get Off',
      'A Long Road',
      'Cunning Stunts',
      'Master of None',
      'The Shootist',
      'Top Fun',
      'Baited My Tackle',
      'Strangers & Freaks',
      'Whip It Good'
    ]);
    
    // Set demo progress
    saveProgress(demoEarned, DEMO_KEY);
    
    // Also set some count progress
    const countedTrophies = allTrophies.filter(t => t.count !== null);
    countedTrophies.forEach(t => {
      if (demoEarned.has(t.name)) {
        t._demoProgress = t.count; // Max out counted trophies
      }
    });
    
    // Force re-render to pick up demo earned set
    render();
    // Trigger a second render after a small delay to ensure DOM updates
    setTimeout(render, 100);
  }
}

// Initialize on load
initDemoMode();
