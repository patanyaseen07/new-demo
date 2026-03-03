/* ============================================
   Dashboard JavaScript
   ============================================ */

// State
let selectMode = false;
let currentFilter = 'all';

// ============================================
// Filter Functionality
// ============================================
function filterProblems(filter, btn) {
    currentFilter = filter;

    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');

    // Filter cards
    document.querySelectorAll('.problem-card').forEach(card => {
        const phase = card.dataset.phase;
        const isLive = card.dataset.live === 'true' && phase !== 'restate_problem';

        let show = false;
        const completedPhases = new Set([
            // Only sessions that have completed up to idea_results
            'idea_results'
        ]);

        const collectingPhases = new Set(['collect', 'deep_dive', 'ideas']);
        const votingPhases = new Set(['vote', 'similar_whys', 'idea_vote']);

        switch (filter) {
            case 'all': show = true; break;
            case 'live': show = isLive; break;
            case 'collect': show = collectingPhases.has(phase); break;
            case 'vote': show = votingPhases.has(phase); break;
            case 'completed': show = completedPhases.has(phase); break;
            case 'result': show = phase === 'result'; break;
            case 'draft': show = phase === 'draft'; break;
        }

        card.classList.toggle('hidden', !show);
    });

    // Show empty state if no results
    updateEmptyState();
}

function updateEmptyState() {
    const visibleCards = document.querySelectorAll('.problem-card:not(.hidden)');
    const emptyState = document.querySelector('.empty-state');
    const grid = document.querySelector('.problems-grid');

    if (visibleCards.length === 0 && !emptyState) {
        // Create empty state for filter
        const filterEmpty = document.createElement('div');
        filterEmpty.className = 'empty-state filter-empty';
        filterEmpty.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <h3>No matching sessions</h3>
            <p>Try selecting a different filter</p>
        `;
        grid.appendChild(filterEmpty);
    } else {
        // Remove filter empty state if exists
        const filterEmpty = document.querySelector('.filter-empty');
        if (filterEmpty && visibleCards.length > 0) {
            filterEmpty.remove();
        }
    }
}

// ============================================
// Live Countdown Timer
// ============================================
function updateLiveTimers() {
    document.querySelectorAll('.time-value').forEach(el => {
        // Use the global updateTimerDisplay function
        if (window.updateTimerDisplay) {
            window.updateTimerDisplay(el);
        } else {
            // Fallback if global function is not available (shouldn't happen if global.js loads first)
            let remaining = parseInt(el.dataset.remaining);
            if (remaining > 0) {
                remaining--;
                el.dataset.remaining = remaining;
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

                if (remaining <= 0) {
                    window.location.reload();
                }
            } else if (remaining === 0) {
                el.textContent = `0:00`;
                window.location.reload();
            }
        }
    });
}

// Start timer updates
setInterval(updateLiveTimers, 1000);

// ============================================
// Dashboard Polling for Live Updates
// ============================================
let dashboardPollingInterval = null;

async function fetchAllProblemsStatus() {
    const config = window.FISHBONE_CONFIG || {};
    if (!config.urls || !config.urls.allProblemsStatus) {
        console.error('Dashboard polling URL not configured.');
        return;
    }

    try {
        const response = await fetch(config.urls.allProblemsStatus);
        const data = await response.json();

        if (response.ok && data.success && data.problems) {
            let needsFilterUpdate = false;
            document.querySelectorAll('.problem-card').forEach(card => {
                const problemId = card.dataset.id;
                const currentPhase = card.dataset.phase;
                const currentIsLive = card.dataset.live === 'true';

                const newStatus = data.problems[problemId];
                if (newStatus) {
                    // Update problemData object
                    if (problemsData[problemId]) {
                        problemsData[problemId].phase = newStatus.phase;
                        problemsData[problemId].isLive = newStatus.is_live;
                        problemsData[problemId].remaining = newStatus.remaining;
                    }

                    // Update card attributes
                    card.dataset.phase = newStatus.phase;
                    card.dataset.live = newStatus.is_live;

                    // Update visual elements
                    const phaseTag = card.querySelector('.phase-tag');
                    if (phaseTag) {
                        phaseTag.className = `phase-tag phase-${newStatus.phase}`;
                        phaseTag.textContent = getPhaseDisplayName(newStatus.phase);
                    }

                    const liveBadge = card.querySelector('.live-badge');
                    if (liveBadge) {
                        if (newStatus.is_live && newStatus.phase !== 'restate_problem') {
                            liveBadge.style.display = 'inline-flex';
                        } else {
                            liveBadge.style.display = 'none';
                        }
                    }

                    const timeRemainingEl = card.querySelector('.time-remaining');
                    const timeValueEl = card.querySelector('.time-value');
                    if (newStatus.is_live && newStatus.remaining > 0 && newStatus.phase !== 'restate_problem') {
                        if (timeRemainingEl) timeRemainingEl.style.display = 'flex';
                        if (timeValueEl) {
                            timeValueEl.dataset.remaining = newStatus.remaining;
                            const mins = Math.floor(newStatus.remaining / 60);
                            const secs = newStatus.remaining % 60;
                            timeValueEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                        }
                    } else {
                        if (timeRemainingEl) timeRemainingEl.style.display = 'none';
                    }

                    // Check if phase or live status changed, which might require re-filtering
                    if (currentPhase !== newStatus.phase || currentIsLive !== newStatus.is_live) {
                        needsFilterUpdate = true;
                    }
                }
            });

            if (needsFilterUpdate) {
                filterProblems(currentFilter, document.querySelector(`.filter-tab[data-filter="${currentFilter}"]`));
            }
        } else {
            console.error('Failed to fetch all problems status:', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error fetching all problems status:', error);
    }
}

function startDashboardPolling() {
    if (dashboardPollingInterval) {
        clearInterval(dashboardPollingInterval);
    }
    // Poll every 5 seconds
    dashboardPollingInterval = setInterval(fetchAllProblemsStatus, 5000);
}

// Start dashboard polling on load
document.addEventListener('DOMContentLoaded', startDashboardPolling);


// ============================================
// Selection Mode
// ============================================
function enterSelectMode() {
    selectMode = true;
    document.getElementById('normal-actions').style.display = 'none';
    document.getElementById('select-actions').style.display = 'flex';
    document.querySelectorAll('.problem-card').forEach(card => card.classList.add('select-mode'));
    updateSelectionCount();
}

function exitSelectMode() {
    selectMode = false;
    document.getElementById('normal-actions').style.display = 'flex';
    document.getElementById('select-actions').style.display = 'none';
    document.querySelectorAll('.problem-card').forEach(card => {
        card.classList.remove('select-mode', 'selected');
        const checkbox = card.querySelector('.hidden-checkbox');
        if (checkbox) checkbox.checked = false;
    });
}

function handleCardClick(event, card) {
    // If in select mode, toggle selection
    if (selectMode) {
        if (event.target.closest('.btn-enter')) return;
        const checkbox = card.querySelector('.hidden-checkbox');
        card.classList.toggle('selected');
        if (checkbox) checkbox.checked = card.classList.contains('selected');
        updateSelectionCount();
        return;
    }

    // Otherwise, open detail modal
    if (event.target.closest('.btn-enter') || event.target.closest('.icon-btn')) return;

    const problemId = card.dataset.id;

    if (typeof problemsData !== 'undefined' && problemsData[problemId]) {
        openDetailModal(problemsData[problemId]);
    }
}

function toggleSelectAll() {
    const visibleCards = document.querySelectorAll('.problem-card:not(.hidden)');
    const selectedVisible = document.querySelectorAll('.problem-card:not(.hidden).selected').length;
    const allSelected = selectedVisible === visibleCards.length && visibleCards.length > 0;

    visibleCards.forEach(card => {
        const checkbox = card.querySelector('.hidden-checkbox');
        if (allSelected) {
            card.classList.remove('selected');
            if (checkbox) checkbox.checked = false;
        } else {
            card.classList.add('selected');
            if (checkbox) checkbox.checked = true;
        }
    });
    updateSelectionCount();
}

function updateSelectionCount() {
    const count = document.querySelectorAll('.problem-card.selected').length;
    const visibleCards = document.querySelectorAll('.problem-card:not(.hidden)');
    const selectedVisible = document.querySelectorAll('.problem-card:not(.hidden).selected').length;

    const countEl = document.getElementById('selection-count');
    const deleteBtn = document.getElementById('delete-selected-btn');
    const selectAllBtn = document.getElementById('select-all-btn');

    if (countEl) countEl.innerText = `${count} selected`;
    if (deleteBtn) deleteBtn.disabled = count === 0;
    if (selectAllBtn) {
        selectAllBtn.innerText = selectedVisible === visibleCards.length && visibleCards.length > 0
            ? 'Deselect All'
            : 'Select All';
    }
}

// ============================================
// Delete Functions
// ============================================
function submitBulkDelete() {
    const count = document.querySelectorAll('.problem-card.selected').length;
    if (count === 0) return;

    showConfirmModal(
        `Delete ${count} session${count > 1 ? 's' : ''}?`,
        'All related feedback and votes will be permanently removed.',
        () => document.getElementById('bulk-delete-form').submit()
    );
}

function deleteSingle(event, problemId) {
    event.stopPropagation();
    showConfirmModal(
        'Delete this session?',
        'All related feedback and votes will be permanently removed.',
        () => {
            const form = document.getElementById('single-delete-form');
            form.action = `/problem/${problemId}/delete`;
            form.submit();
        }
    );
}

// ============================================
// Modal Functions
// ============================================
let pendingAction = null;

function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    pendingAction = onConfirm;
    document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    pendingAction = null;
}

function openCreateModal() {
    document.getElementById('create-modal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('create-modal').style.display = 'none';
}

// ============================================
// Detail Modal Functions
// ============================================
function openDetailModal(problem) {
    const modal = document.getElementById('detail-modal');

    // Set tags (LIVE + phase)
    let tagsHtml = '';
    if (problem.isLive && problem.phase !== 'restate_problem') {
        tagsHtml += '<span class="live-badge"><span class="live-pulse"></span>LIVE</span>';
    }
    tagsHtml += `<span class="phase-tag phase-${problem.phase}">${getPhaseDisplayName(problem.phase)}</span>`;
    document.getElementById('detail-tags').innerHTML = tagsHtml;

    // Set content
    document.getElementById('detail-title').innerText = problem.title;
    document.getElementById('detail-description').innerText = problem.description;

    // Set timer
    const timerEl = document.getElementById('detail-timer');
    if (problem.isLive && problem.remaining > 0 && problem.phase !== 'restate_problem') {
        const mins = Math.floor(problem.remaining / 60);
        const secs = problem.remaining % 60;
        document.getElementById('detail-time-value').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        timerEl.style.display = 'inline-flex';
    } else {
        timerEl.style.display = 'none';
    }

    // Set meta info
    document.getElementById('detail-phase').innerText = getPhaseDisplayName(problem.phase);
    document.getElementById('detail-duration').innerText = formatDuration(problem.duration);

    // Set action button
    const actionBtn = document.getElementById('detail-action-btn');
    actionBtn.href = problem.url;
    actionBtn.innerHTML = getActionText(problem.phase, problem.isLive) +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>';

    if (problem.isLive && problem.phase !== 'restate_problem') {
        actionBtn.classList.add('btn-live');
    } else {
        actionBtn.classList.remove('btn-live');
    }

    modal.style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

function getPhaseDisplayName(phase) {
    const names = {
        'draft': 'Draft',
        'collect': 'Phase 1 · Collecting',
        'aggregate': 'Phase 2 · Fishbone View',
        'vote': 'Phase 3 · Dot Voting',
        'result': 'Phase 3 · Results',
        'deep_dive': 'Phase 4 · 5 Whys',
        'similar_whys': 'Phase 5 · Similar Whys',
        'pareto_view': 'Phase 5 · Pareto Chart',
        'restate_problem': 'Phase 6 · Restate Problem',
        'final_statement_display': 'Phase 6 · Final Statement',
        'ideas': 'Phase 7 · Idea Collection',
        'idea_vote': 'Phase 7 · Idea Voting',
        'idea_results': 'Phase 8 · Final Results'
    };
    return names[phase] || phase;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
    return `${mins} minutes`;
}

function getActionText(phase, isLive) {
    if (phase === 'collect') return isLive ? 'Add Feedback Now ' : 'Add Feedback ';
    if (phase === 'vote') return isLive ? 'Vote Now ' : 'Cast Your Vote ';
    if (phase === 'deep_dive') return isLive ? 'Start Deep Dive ' : 'Enter Deep Dive ';
    if (phase === 'similar_whys') return isLive ? 'Vote on Whys ' : 'Vote on Whys ';
    if (phase === 'ideas') return isLive ? 'Submit Ideas Now ' : 'Submit Ideas ';
    if (phase === 'idea_vote') return isLive ? 'Vote on Ideas Now ' : 'Vote on Ideas ';
    if (phase === 'idea_results') return 'View Final Results ';
    if (phase === 'aggregate') return 'View Aggregate ';
    if (phase === 'result') return 'View Results ';
    if (phase === 'pareto_view') return 'View Pareto Chart ';
    if (phase === 'final_statement_display') return 'View Statement ';
    return 'Enter Session ';
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Confirm modal action button
    const confirmBtn = document.getElementById('confirm-action-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (pendingAction) pendingAction();
            closeConfirmModal();
        });
    }

    // Close modals on overlay click
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') closeConfirmModal();
        });
    }

    const createModal = document.getElementById('create-modal');
    if (createModal) {
        createModal.addEventListener('click', (e) => {
            if (e.target.id === 'create-modal') closeCreateModal();
        });
    }

    const detailModal = document.getElementById('detail-modal');
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target.id === 'detail-modal') closeDetailModal();
        });
    }

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeConfirmModal();
            closeCreateModal();
            closeDetailModal();
        }
    });

    // Card Click Handler (Event Delegation)
    document.querySelector('.problems-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.problem-card');
        if (card) {
            handleCardClick(e, card);
        }
    });
});
