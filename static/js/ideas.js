/**
 * Fishbone RCA - Idea Collection Phase JavaScript
 * Handles timer display, idea submission with AI categorization
 */
document.addEventListener('DOMContentLoaded', () => {
    const config = window.FISHBONE_CONFIG;
    if (!config) return;

    // Timer Auto-Advance Logic (Admin Only)
    const timerEl = document.getElementById('phase-timer');
    let remainingSeconds = parseInt(timerEl?.dataset.remaining || 0);
    let timerInterval;
    let timerExpired = remainingSeconds <= 0;

    function updateTimerDisplay() {
        if (!timerEl) return;
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        timerEl.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        if (!timerEl) return;
        if (timerInterval) clearInterval(timerInterval);

        updateTimerDisplay();

        timerInterval = setInterval(() => {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                timerEl.dataset.remaining = remainingSeconds;
                updateTimerDisplay();

                if (remainingSeconds <= 0) {
                    timerExpired = true;
                    lockSubmissions();
                }
            }

            // No auto-advance for ideas phase — admin advances manually via the Next Phase button
        }, 1000);
    }

    // Polling for Users
    function startPolling() {
        if (config.isAdmin) return;

        setInterval(async function () {
            try {
                const response = await fetch(config.urls.status);
                const data = await response.json();

                if (data.phase && data.phase !== 'ideas') {
                    let redirectUrl = `/problem/${config.problemId}`; // Default to generic view_problem

                    if (data.phase === 'pareto_view') {
                        redirectUrl = `/pareto_chart/${config.problemId}`;
                    } else if (data.phase === 'restate_problem') {
                        redirectUrl = `/problem/${config.problemId}/restate_problem`;
                    } else if (data.phase === 'final_statement_display') {
                        redirectUrl = `/problem/${config.problemId}/final_statement_display`;
                    } else if (data.phase === 'result') {
                        redirectUrl = `/results/${config.problemId}`;
                    }
                    // For other phases like 'collect', 'aggregate', 'vote', 'deep_dive', 'similar_whys',
                    // the generic /problem/${config.problemId} will correctly render the template via view_problem.

                    window.location.href = redirectUrl;
                }

                // Update timer from server — auto-reload if time was added back
                if (data.remaining !== undefined) {
                    if (timerExpired && data.remaining > 0) {
                        window.location.reload();
                        return;
                    }
                    remainingSeconds = data.remaining;
                    updateTimerDisplay();
                }

            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 5000); // Poll every 5 seconds
    }

    if (timerEl) {
        startTimer();
    }

    // Start polling for users (if not admin)
    if (!config.isAdmin) {
        startPolling();
    }

    // Add more time via AJAX
    window.addMoreTime = async function () {
        const btn = document.getElementById('add-time-btn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Adding...";

        try {
            const res = await fetch(config.urls.extendTime, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_id: config.problemId,
                    minutes: 10
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                window.location.reload();
            } else {
                btn.innerText = "Error";
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }, 1500);
            }
        } catch (e) {
            btn.innerText = "Error";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
            }, 1500);
        }
    };

    // Lock submissions when timer expires
    function lockSubmissions() {
        const btn = document.getElementById('submit-idea');
        const input = document.getElementById('idea-input');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Time's Up";
        }
        if (input) {
            input.disabled = true;
            input.placeholder = "Time has expired";
        }
    }

    // Lock immediately if page loads with 0 time
    if (timerExpired && timerEl) {
        lockSubmissions();
    }

    // Submit Idea
    const submitBtn = document.getElementById('submit-idea'); // Changed ID
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const input = document.getElementById('idea-input'); // Changed ID
            const btn = document.getElementById('submit-idea'); // Changed ID
            const msg = document.getElementById('status-msg');

            if (!input.value.trim()) return;

            btn.disabled = true;
            btn.innerText = "Processing (AI)...";

            try {
                const res = await fetch(config.urls.submitFeedback, { // config.urls.submitFeedback now points to 'submit_idea'
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        problem_id: config.problemId,
                        content: input.value
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    const rawContent = input.value;
                    input.value = '';
                    // Prepend to list
                    const list = document.getElementById('my-list');
                    const item = document.createElement('div');
                    item.className = 'idea-item';

                    // Match inline styles from server template
                    item.style.background = 'var(--bg-color)';
                    item.style.border = '1px solid var(--border-color)';
                    item.style.padding = '0.75rem';
                    item.style.borderRadius = '8px';
                    item.style.marginBottom = '0.5rem';

                    const truncatedContent = rawContent.length > 30 ? rawContent.substring(0, 30) + '...' : rawContent;

                    item.innerHTML = `
                        <div style="font-weight: 500; font-size: 0.95rem; margin-bottom: 0.25rem;">${data.normalized_content}</div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${truncatedContent}</span>
                        </div>
                    `;
                    list.prepend(item);
                    msg.innerText = "Saved!";
                } else {
                    msg.innerText = "Error: " + data.error;
                }
            } catch (e) {
                msg.innerText = "Network Error";
            } finally {
                btn.disabled = false;
                btn.innerText = "Analyze & Submit Idea"; // Changed button text
            }
        });
    }
});
