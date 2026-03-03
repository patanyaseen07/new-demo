/**
 * Phase: Restate Problem Statement
 * Handles admin refinement and user viewing
 */

(function () {
    'use strict';

    // ========== Configuration ==========
    const configEl = document.getElementById('config-data');
    if (!configEl) return;

    const CONFIG = {
        problemId: configEl.dataset.problemId,
        isAdmin: configEl.dataset.isAdmin === 'true',
        urls: {
            extend: configEl.dataset.urlExtend,
            refine: configEl.dataset.urlRefine,
            save: configEl.dataset.urlSave,
            status: configEl.dataset.urlStatus,
            transitionPhase: configEl.dataset.urlTransitionPhase // New URL
        },
        remainingTime: parseInt(configEl.dataset.remainingTime || '0')
    };

    // ========== DOM Elements ==========
    const elements = {
        timer: document.getElementById('phase-timer'),
        timerContainer: document.getElementById('timer-container'),
        addTimeBtn: document.getElementById('add-time-btn'),
        refineBtn: document.getElementById('refine-btn'),
        regenerateBtn: document.getElementById('regenerate-btn'),
        saveBtn: document.getElementById('save-btn'),
        nextPhaseBtn: document.getElementById('next-phase-btn'),
        refineSection: document.getElementById('refine-section'),
        refinedSection: document.getElementById('refined-section'),
        refinedStatement: document.getElementById('refined-statement'),
        loadingState: document.getElementById('loading-state'),
        errorToast: document.getElementById('error-toast'),
        errorMessage: document.getElementById('error-message'),
        successToast: document.getElementById('success-toast'),
        successMessage: document.getElementById('success-message'),
        mostVotedText: document.getElementById('most-voted-text'), // Add this element
        backToParetoBtn: document.getElementById('back-to-pareto-btn') // New back button
    };

    // ========== State ==========
    let remainingSeconds = CONFIG.remainingTime;
    let timerInterval = null;
    let pollInterval = null;

    // ========== API Functions (for phase transitions) ==========
    async function transitionPhase(targetPhase) {
        const btn = elements.backToParetoBtn; // Assuming this is the button that triggers it
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;

        try {
            const response = await fetch(CONFIG.urls.transitionPhase, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    problem_id: CONFIG.problemId,
                    target_phase: targetPhase
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Failed to transition to phase ${targetPhase}`);
            }

            showSuccess(data.message || `Successfully moved to Phase ${targetPhase}.`);
            // Redirect the admin directly to the target phase page after a short delay for smoother UX
            setTimeout(() => {
                // Stop polling before redirecting to prevent interference
                if (pollInterval) clearInterval(pollInterval);

                let redirectUrl;
                if (targetPhase === 'pareto_view') {
                    redirectUrl = `/pareto_chart/${CONFIG.problemId}`;
                } else {
                    redirectUrl = `/problem/${CONFIG.problemId}/${targetPhase}`;
                }
                window.location.href = redirectUrl;
            }, 500); // 500ms delay

        } catch (error) {
            console.error('Error transitioning phase:', error);
            showError(error.message || `Failed to transition to phase ${targetPhase}`);
        } finally {
            // Restore button state after a short delay or immediately
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1000); // Give some time for the success/error toast to be seen
        }
    }

    // ========== Timer Functions ==========
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateTimerDisplay() {
        if (!elements.timer) return;

        elements.timer.textContent = formatTime(remainingSeconds);

        // Update timer styling based on remaining time
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

        timerInterval = setInterval(function () {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    // ========== Toast Notifications ==========
    function showError(message) {
        if (!elements.errorToast || !elements.errorMessage) return;

        elements.errorMessage.textContent = message;
        elements.errorToast.style.display = 'flex';

        setTimeout(function () {
            elements.errorToast.style.display = 'none';
        }, 4000);
    }

    function showSuccess(message) {
        if (!elements.successToast || !elements.successMessage) return;

        elements.successMessage.textContent = message;
        elements.successToast.style.display = 'flex';

        setTimeout(function () {
            elements.successToast.style.display = 'none';
        }, 3000);
    }

    // ========== Loading State ==========
    function showLoading() {
        if (elements.loadingState) {
            elements.loadingState.style.display = 'block';
        }
        if (elements.refineSection) {
            elements.refineSection.style.display = 'none';
        }
    }

    function hideLoading() {
        if (elements.loadingState) {
            elements.loadingState.style.display = 'none';
        }
    }

    // ========== API Functions ==========
    async function refineStatement() {
        const mostVotedStatement = elements.mostVotedText ? elements.mostVotedText.textContent.trim() : '';
        if (!mostVotedStatement || mostVotedStatement === 'Loading...') {
            showError('No statement to refine');
            return;
        }

        showLoading();

        try {
            const response = await fetch(CONFIG.urls.refine, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    statement: mostVotedStatement,
                    problem_id: CONFIG.problemId
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to refine statement');
            }

            hideLoading();

            const isLLMError = data.refined_statement &&
                data.refined_statement.startsWith('Failed to refine (LLM Error):');

            if (elements.refinedStatement) {
                // On LLM error, pre-fill with the original most-voted statement
                // so the admin can edit it manually instead of seeing the error text
                elements.refinedStatement.value = isLLMError
                    ? (elements.mostVotedText ? elements.mostVotedText.textContent.trim() : '')
                    : data.refined_statement;
            }
            if (elements.refinedSection) {
                elements.refinedSection.style.display = 'block';
            }

            if (isLLMError) {
                const banner = document.getElementById('llm-error-banner');
                if (banner) banner.style.display = 'flex';
                // Rename save button so admin knows what to do
                if (elements.saveBtn) {
                    elements.saveBtn.innerHTML = elements.saveBtn.innerHTML.replace('Save Changes', 'Save &amp; Share');
                }
                // Don't auto-save the error text
            } else {
                // Auto-save only when AI succeeded
                await saveStatement(data.refined_statement);
            }

        } catch (error) {
            console.error('Error refining statement:', error);
            hideLoading();

            if (elements.refineSection) {
                elements.refineSection.style.display = 'block';
            }
            showError(error.message || 'Failed to refine statement');
        }
    }

    async function saveStatement(statement) {
        if (!statement) {
            showError('No statement to save');
            return false;
        }

        try {
            const response = await fetch(CONFIG.urls.save, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refined_statement: statement,
                    problem_id: CONFIG.problemId
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to save');
            }

            showSuccess('Statement saved successfully');

            // Enable next phase button
            if (elements.nextPhaseBtn) {
                elements.nextPhaseBtn.disabled = false;
            }

            return true;

        } catch (error) {
            console.error('Error saving statement:', error);
            showError(error.message || 'Failed to save statement');
            return false;
        }
    }

    async function addTime() {
        const btn = elements.addTimeBtn;
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Adding...';

        try {
            const response = await fetch(CONFIG.urls.extend, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    problem_id: CONFIG.problemId,
                    minutes: 10
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to add time');
            }

            remainingSeconds = data.new_remaining_seconds;
            updateTimerDisplay();

            btn.innerHTML = '✓ Added';
            setTimeout(function () {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 1500);

        } catch (error) {
            console.error('Error adding time:', error);
            showError(error.message || 'Failed to add time');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // ========== Polling for Users ==========
    function startPolling() {
        if (CONFIG.isAdmin) return;

        pollInterval = setInterval(async function () {
            try {
                const response = await fetch(CONFIG.urls.status);
                const data = await response.json();

                if (data.phase && data.phase !== 'restate_problem') {
                    window.location.href = window.location.origin + '/problem/' + CONFIG.problemId;
                } else if (data.phase && data.phase === 'restate_problem' && window.location.pathname.indexOf('/restate_problem') === -1) {
                    window.location.href = window.location.origin + '/problem/' + CONFIG.problemId;
                }

                // Update timer from server
                if (data.remaining !== undefined) {
                    remainingSeconds = data.remaining;
                    updateTimerDisplay();
                }

            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 5000); // Poll every 5 seconds
    }

    // ========== Event Listeners ==========
    function setupEventListeners() {
        // Refine button
        if (elements.refineBtn) {
            elements.refineBtn.addEventListener('click', refineStatement);
        }

        // Regenerate button
        if (elements.regenerateBtn) {
            elements.regenerateBtn.addEventListener('click', refineStatement);
        }

        // Save button
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', function () {
                const statement = elements.refinedStatement ? elements.refinedStatement.value : '';
                saveStatement(statement);
            });
        }

        // Add time button
        if (elements.addTimeBtn) {
            elements.addTimeBtn.addEventListener('click', addTime);
        }

        // Enable/disable save based on textarea changes
        if (elements.refinedStatement) {
            elements.refinedStatement.addEventListener('input', function () {
                if (elements.saveBtn) {
                    elements.saveBtn.disabled = !this.value.trim();
                }
            });
        }

        // Back to Pareto button (Admin only)
        if (elements.backToParetoBtn && CONFIG.isAdmin) {
            elements.backToParetoBtn.addEventListener('click', () => {
                transitionPhase('pareto_view'); // Target Phase 5
            });
        }
    }

    // ========== Initialization ==========
    function init() {
        // Start timer only if there's remaining time (i.e., phase is active)
        if (CONFIG.remainingTime > 0) {
            startTimer();
        } else {
            // If no timer, just update display to show 0:00
            updateTimerDisplay();

            // Ensure timer container is visible but marked as ended
            if (elements.timerContainer) {
                elements.timerContainer.classList.add('ended');
            }
        }

        // Setup events
        setupEventListeners();

        // Start polling for users (if not admin)
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

    // Cleanup on page unload
    window.addEventListener('beforeunload', function () {
        if (timerInterval) clearInterval(timerInterval);
        if (pollInterval) clearInterval(pollInterval);
    });

})();
