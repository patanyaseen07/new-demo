/**
 * Fishbone RCA - Collection Phase JavaScript
 * Handles timer display, feedback submission with AI categorization
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

        }, 1000);
    }

    // Polling for Users
    function startPolling() {
        if (config.isAdmin) return;

        setInterval(async function() {
            try {
                const response = await fetch(config.urls.status);
                const data = await response.json();

                // If the server's current phase is different from the client's current phase, redirect to the base problem URL
                if (data.phase && data.phase !== 'collect') {
                    window.location.href = window.location.origin + '/problem/' + config.problemId;
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

    // Add more time via AJAX — reload page on success so everything resets cleanly
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
        const btn = document.getElementById('submit-cause');
        const input = document.getElementById('cause-input');
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

    // Submit Feedback
    const submitBtn = document.getElementById('submit-cause');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const input = document.getElementById('cause-input');
            const btn = document.getElementById('submit-cause');
            const msg = document.getElementById('status-msg');

            if (!input.value.trim()) return;

            btn.disabled = true;
            btn.innerText = "Processing (AI)...";

            try {
                const res = await fetch(config.urls.submitFeedback, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        problem_id: config.problemId,
                        content: input.value
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    input.value = '';
                    // Prepend to list
                    const list = document.getElementById('my-list');
                    const item = document.createElement('div');
                    item.className = 'cause-item';
                    item.innerHTML = `<span>${data.normalized_content}</span> <span style="font-size:0.8rem; color:var(--accent-color); border:1px solid var(--accent-color); padding:0 2px; border-radius:4px;">${data.category}</span>`;
                    list.prepend(item);
                    msg.innerText = "Saved!";
                } else {
                    msg.innerText = "Error: " + data.error;
                }
            } catch (e) {
                msg.innerText = "Network Error";
            } finally {
                btn.disabled = false;
                btn.innerText = "Analyze & Submit";
            }
        });
    }
});
