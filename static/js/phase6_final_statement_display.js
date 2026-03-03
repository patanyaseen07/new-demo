/**
 * Phase 6: Final Problem Statement Display
 * Handles timer, admin controls, and user auto-refresh
 */

(function() {
    'use strict';

    // ========== Configuration ==========
    const configEl = document.getElementById('config-data');
    if (!configEl) {
        console.error('Config element not found');
        return;
    }

    const CONFIG = {
        problemId: configEl.dataset.problemId,
        isAdmin: configEl.dataset.isAdmin === 'true',
        currentPhase: configEl.dataset.currentPhase,
        urls: {
            extend: configEl.dataset.urlExtend,
            status: configEl.dataset.urlStatus,
            startPhase: configEl.dataset.urlStartPhase
        },
        remainingTime: parseInt(configEl.dataset.remainingTime || '0')
    };

    // ========== DOM Elements ==========
    const elements = {
        timer: document.getElementById('phase-timer'),
        timerContainer: document.getElementById('timer-container'),
        addTimeBtn: document.getElementById('add-time-btn'), // Re-added addTimeBtn
        startResultsPhaseBtn: document.getElementById('start-results-phase-btn'),
        errorToast: document.getElementById('error-toast'),
        errorMessage: document.getElementById('error-message'),
        successToast: document.getElementById('success-toast'),
        successMessage: document.getElementById('success-message')
    };

    // ========== State ==========
    let remainingSeconds = CONFIG.remainingTime;
    let timerInterval = null;
    let pollInterval = null;
    let isProcessing = false;

    // ========== Utility Functions ==========
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function showToast(type, message) {
        const toast = type === 'error' ? elements.errorToast : elements.successToast;
        const msgEl = type === 'error' ? elements.errorMessage : elements.successMessage;
        
        if (!toast || !msgEl) return;
        
        msgEl.textContent = message;
        toast.style.display = 'flex';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, type === 'error' ? 4000 : 3000);
    }

    function showError(message) {
        showToast('error', message);
    }

    function showSuccess(message) {
        showToast('success', message);
    }

    // ========== Timer Functions ==========
    function updateTimerDisplay() {
        if (!elements.timer) return;
        
        elements.timer.textContent = formatTime(remainingSeconds);

        if (elements.timerContainer) {
            elements.timerContainer.classList.remove('warning', 'ended');
            if (remainingSeconds <= 0) {
                elements.timerContainer.classList.add('ended');
            } else if (remainingSeconds <= 60) {
                elements.timerContainer.classList.add('warning');
            }
        }
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    // ========== API Functions ==========
    async function addTime() {
        if (!elements.addTimeBtn || isProcessing) return;

        const originalHTML = elements.addTimeBtn.innerHTML;
        elements.addTimeBtn.disabled = true;
        elements.addTimeBtn.innerHTML = 'Adding...';

        try {
            const response = await fetch(CONFIG.urls.extend, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_id: CONFIG.problemId,
                    minutes: 10
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                remainingSeconds = data.new_remaining_seconds;
                updateTimerDisplay();
                elements.addTimeBtn.innerHTML = '✓ Added';
                
                setTimeout(() => {
                    elements.addTimeBtn.innerHTML = originalHTML;
                    elements.addTimeBtn.disabled = false;
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to add time');
            }
        } catch (error) {
            console.error('Add time error:', error);
            showError(error.message);
            elements.addTimeBtn.innerHTML = originalHTML;
            elements.addTimeBtn.disabled = false;
        }
    }

    async function startResultsPhase() {
        if (!elements.startResultsPhaseBtn || isProcessing) return;

        isProcessing = true;
        const originalHTML = elements.startResultsPhaseBtn.innerHTML;
        elements.startResultsPhaseBtn.disabled = true;
        elements.startResultsPhaseBtn.innerHTML = '<span class="spinner-small"></span> Starting...';

        try {
            const response = await fetch(`/api/problem/${CONFIG.problemId}/transition_phase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_phase: 'ideas' })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showSuccess('Starting ideas phase...');
                window.location.href = `/problem/${CONFIG.problemId}`;
            } else {
                throw new Error(data.error || 'Failed to start ideas phase');
            }
        } catch (error) {
            console.error('Start results phase error:', error);
            showError(error.message);
            elements.startResultsPhaseBtn.innerHTML = originalHTML;
            elements.startResultsPhaseBtn.disabled = false;
        } finally {
            isProcessing = false;
        }
    }

    // ========== User Polling ==========
    function startPolling() {
        if (CONFIG.isAdmin) return;

        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(CONFIG.urls.status);
                const data = await response.json();
                
                if (data.phase && data.phase !== 'final_statement_display') {
                    clearInterval(pollInterval);
                    let redirectUrl = `/problem/${CONFIG.problemId}`; // Default to generic view_problem

                    if (data.phase === 'pareto_view') {
                        redirectUrl = `/pareto_chart/${CONFIG.problemId}`;
                    } else if (data.phase === 'restate_problem') {
                        redirectUrl = `/problem/${CONFIG.problemId}/restate_problem`;
                    } else if (data.phase === 'final_statement_display') {
                        redirectUrl = `/problem/${CONFIG.problemId}/final_statement_display`;
                    } else if (data.phase === 'result') {
                        redirectUrl = `/results/${CONFIG.problemId}`;
                    } else if (data.phase === 'ideas') {
                        redirectUrl = `/problem/${CONFIG.problemId}?phase=ideas`;
                    }
                    // For other phases like 'collect', 'aggregate', 'vote', 'deep_dive', 'similar_whys',
                    // the generic /problem/${CONFIG.problemId} will correctly render the template via view_problem.

                    window.location.href = redirectUrl;
                    return;
                }

                // Update timer
                if (typeof data.remaining === 'number') {
                    remainingSeconds = data.remaining;
                    updateTimerDisplay();
                }

            } catch (error) {
                console.error('Poll error:', error);
            }
        }, 3000); // Poll every 3 seconds
    }

    // ========== Event Listeners ==========
    function setupEventListeners() {
        // Add time
        if (elements.addTimeBtn) {
            elements.addTimeBtn.addEventListener('click', addTime);
        }

        // Start Results Phase
        if (elements.startResultsPhaseBtn) {
            elements.startResultsPhaseBtn.addEventListener('click', startResultsPhase);
        }
    }

    // ========== Initialization ==========
    function init() {
        // Start timer
        startTimer();

        // Setup event listeners
        setupEventListeners();

        // Start polling for non-admin users
        if (!CONFIG.isAdmin) {
            startPolling();
        }
    }

    // ========== Start ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (timerInterval) clearInterval(timerInterval);
        if (pollInterval) clearInterval(pollInterval);
    });

})();
