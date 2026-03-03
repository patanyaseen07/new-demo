document.addEventListener('DOMContentLoaded', () => {
    const submitAllWhysBtn = document.getElementById('submitAllWhysBtnBottom');
    const submissionMessageDiv = document.getElementById('submissionMessage');
    const deepDiveContentWrapper = document.getElementById('deepDiveContentWrapper');

    // Timer Logic (Copied from collect.js/vote.js for consistency)
    const config = window.FISHBONE_CONFIG || {}; // Ensure config exists
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
        if (timerInterval) clearInterval(timerInterval); // Use local timerInterval

        updateTimerDisplay();

        timerInterval = setInterval(() => { // Use local timerInterval
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

        setInterval(async function () {
            try {
                const response = await fetch(config.urls.status);
                const data = await response.json();

                if (data.phase && data.phase !== 'deep_dive') {
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

    // Add more time via AJAX (Admin only)
    window.addMoreTime = async function () {
        const btn = document.getElementById('add-time-btn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Adding...";

        try {
            const res = await fetch(config.urls.extendTime, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
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
        if (submitAllWhysBtn) {
            submitAllWhysBtn.disabled = true;
            submitAllWhysBtn.innerText = "Time's Up";
        }
        document.querySelectorAll('.why-input-group input').forEach(input => {
            input.disabled = true;
        });
        document.querySelectorAll('.btn-tick').forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
        });
    }

    // Lock immediately if page loads with 0 time
    if (timerExpired && timerEl) {
        lockSubmissions();
    }

    // Enable "Submit All Whys" ONLY when every cause has all 5 whys filled (i.e., 10 whys total for 2 causes)
    // This prevents the button from activating after submitting just 1 why.
    const checkAllWhysFilled = () => {
        const causeSections = Array.from(document.querySelectorAll('.cause-section'));

        // If there are no causes rendered, keep disabled.
        if (causeSections.length === 0) {
            if (submitAllWhysBtn) submitAllWhysBtn.disabled = true;
            return false;
        }

        let allCausesComplete = true;

        for (const causeSection of causeSections) {
            const feedbackId = causeSection.dataset.feedbackId;
            let thisCauseComplete = true;

            for (let i = 1; i <= 5; i++) {
                const input = causeSection.querySelector(`#why-${feedbackId}-${i}`);
                if (!input || input.value.trim() === '') {
                    thisCauseComplete = false;
                    break;
                }
            }

            if (!thisCauseComplete) {
                allCausesComplete = false;
                break;
            }
        }

        if (submitAllWhysBtn) {
            submitAllWhysBtn.disabled = !allCausesComplete;
        }

        return allCausesComplete;
    };

    // Initialize all cause sections on page load if in deep_dive phase
    // These variables are now globally defined in the HTML template
    // const problemId = "{{ problem.id }}";
    // const userRole = "{{ user.role }}";
    // const currentPhase = "deep_dive";
    // let selectedCausesData = []; // This will be populated from the DOM element

    // Ensure selectedCausesData is parsed from the DOM element
    const deepDiveDataEl = document.getElementById('deepDiveData');
    const rawSelectedCausesData = deepDiveDataEl.dataset.selectedCauses;
    const hasCompletedDeepDive = deepDiveDataEl.dataset.hasCompleted === 'true';
    try {
        selectedCausesData = JSON.parse(rawSelectedCausesData);
    } catch (e) {
        console.error('ERROR (JS): Failed to parse selectedCausesData JSON:', e);
        console.error('ERROR (JS): Raw data-selected-causes attribute content:', rawSelectedCausesData);
    }

    // If user has already completed deep dive, skip all interactive setup
    if (hasCompletedDeepDive) {
        // Timer and polling still run so phase transitions work
        // But no interactive elements need setup
        return;
    }

    if (currentPhase === 'deep_dive') {
        document.querySelectorAll('.cause-section').forEach(causeSection => {
            const feedbackId = causeSection.dataset.feedbackId;
            const causeData = selectedCausesData.find(cause => cause.id === feedbackId);
            let firstUnansweredWhy = 1;

            if (causeData) {
                const existingWhysMap = new Map(causeData.whys.map(w => [w.why_number, w.answer]));

                for (let i = 1; i <= 5; i++) {
                    const input = causeSection.querySelector(`#why-${feedbackId}-${i}`);
                    const tickButton = causeSection.querySelector(`.btn-tick[data-cause-id="${feedbackId}"][data-why-number="${i}"]`);
                    const existingAnswer = existingWhysMap.get(i);

                    if (input) {
                        if (existingAnswer) {
                            input.value = existingAnswer;
                            input.disabled = true; // Keep disabled if already answered
                            if (tickButton) tickButton.classList.add('hidden'); // Keep hidden if already answered
                            firstUnansweredWhy = i + 1; // Move to the next why
                        } else {
                            // For unanswered whys, their initial state is set by HTML.
                            // We only need to ensure the first unanswered one is enabled/visible.
                        }
                    }
                }

                // After processing all existing whys, ensure the first unanswered one is enabled and its tick button shown
                if (firstUnansweredWhy <= 5) {
                    const nextInput = causeSection.querySelector(`#why-${feedbackId}-${firstUnansweredWhy}`);
                    const nextTickButton = causeSection.querySelector(`.btn-tick[data-cause-id="${feedbackId}"][data-why-number="${firstUnansweredWhy}"]`);
                    if (nextInput) {
                        nextInput.disabled = false;
                    }
                    if (nextTickButton) {
                        nextTickButton.classList.remove('hidden');
                    }
                }
            }
        });
        checkAllWhysFilled(); // Initial check for submit button status
    }

    // Function to lock the page into "submitted" state
    function lockAfterSubmission() {
        // Disable all inputs
        document.querySelectorAll('.why-input-group input').forEach(input => {
            input.disabled = true;
        });
        // Hide all tick buttons
        document.querySelectorAll('.btn-tick').forEach(btn => {
            btn.classList.add('hidden');
        });
        // Replace submit button area with success card
        const submitSection = document.querySelector('.submit-section') || (submitAllWhysBtn ? submitAllWhysBtn.closest('.deep-dive-footer') : null);
        if (submitSection) {
            submitSection.innerHTML = `
                <div style="background:var(--card-bg, #fff); border:1px solid var(--success-color, #047857); border-radius:12px; display:inline-block; padding: 1.5rem 2rem; text-align:center;">
                    <div style="color:var(--success-color, #047857); margin-bottom:0.5rem; font-size: 1.5rem;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h3 style="color:var(--success-color, #047857); margin-bottom:0.5rem;">Whys Submitted</h3>
                    <p style="color:var(--text-muted, #666); margin-bottom:0;">Your whys are locked. Wait for next phase.</p>
                    <button onclick="window.location.reload()" class="btn-secondary btn-sm" style="margin-top: 1rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        Refresh Status
                    </button>
                </div>
            `;
        }
    }

    // Auto-lock if all whys are already filled on page load (data was already saved)
    const allCauseSections = document.querySelectorAll('.cause-section');
    if (allCauseSections.length > 0) {
        let allComplete = true;
        allCauseSections.forEach(causeSection => {
            const feedbackId = causeSection.dataset.feedbackId;
            for (let i = 1; i <= 5; i++) {
                const input = causeSection.querySelector(`#why-${feedbackId}-${i}`);
                if (!input || input.value.trim() === '') {
                    allComplete = false;
                }
            }
        });
        if (allComplete) {
            lockAfterSubmission();
        }
    }

    // Shared function to advance to next Why
    function advanceToNextWhy(causeId, currentWhyNumber, currentInput) {
        if (currentInput && currentInput.value.trim() !== '') {
            // Lock current input
            currentInput.disabled = true;

            // Hide current tick button
            const currentTickButton = document.querySelector(`.btn-tick[data-cause-id="${causeId}"][data-why-number="${currentWhyNumber}"]`);
            if (currentTickButton) {
                currentTickButton.classList.add('hidden');
            }

            // Unlock next input
            const nextWhyNumber = currentWhyNumber + 1;
            if (nextWhyNumber <= 5) {
                const nextInput = document.getElementById(`why-${causeId}-${nextWhyNumber}`);
                if (nextInput) {
                    nextInput.disabled = false;
                    nextInput.focus();
                }
                const nextTickButton = document.querySelector(`.btn-tick[data-cause-id="${causeId}"][data-why-number="${nextWhyNumber}"]`);
                if (nextTickButton) {
                    nextTickButton.classList.remove('hidden'); // Show next tick button
                }
            }
            checkAllWhysFilled(); // Re-check submit button status
            return true;
        }
        return false;
    }

    // Add Enter key listener to all why inputs
    document.querySelectorAll('.why-input-group input').forEach(input => {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const inputId = input.id; // Format: why-{causeId}-{whyNumber}
                const parts = inputId.split('-');
                const causeId = parts.slice(1, -1).join('-'); // Handle UUID with dashes
                const whyNumber = parseInt(parts[parts.length - 1]);

                if (!advanceToNextWhy(causeId, whyNumber, input)) {
                    // Show error if input is empty
                    if (submissionMessageDiv) {
                        submissionMessageDiv.textContent = 'Please enter an answer before pressing Enter.';
                        submissionMessageDiv.style.setProperty('display', 'block', 'important');
                        submissionMessageDiv.classList.remove('alert-success');
                        submissionMessageDiv.classList.add('alert-danger');
                        setTimeout(() => {
                            submissionMessageDiv.style.setProperty('display', 'none', 'important');
                        }, 3000);
                    }
                }
            }
        });
    });

    // Tick button click handler (also uses the shared function)
    document.querySelectorAll('.btn-tick').forEach(button => {
        button.addEventListener('click', (event) => {
            const causeId = event.currentTarget.dataset.causeId;
            const whyNumber = parseInt(event.currentTarget.dataset.whyNumber);
            const currentInput = document.getElementById(`why-${causeId}-${whyNumber}`);

            if (!advanceToNextWhy(causeId, whyNumber, currentInput)) {
                submissionMessageDiv.textContent = 'Please fill the current "Why" before proceeding.';
                submissionMessageDiv.style.setProperty('display', 'block', 'important');
                submissionMessageDiv.classList.remove('alert-success');
                submissionMessageDiv.classList.add('alert-danger');
            }
        });
    });

    // Event listener for the main submit button
    if (submitAllWhysBtn) {
        submitAllWhysBtn.addEventListener('click', async () => {
            const allWhysData = [];
            document.querySelectorAll('.cause-section').forEach(causeSection => {
                const feedbackId = causeSection.dataset.feedbackId;
                const whysForCause = [];
                causeSection.querySelectorAll('.why-step input').forEach(input => {
                    const whyNumber = parseInt(input.dataset.whyNumber);
                    const answer = input.value.trim();
                    if (answer) {
                        whysForCause.push({ why_number: whyNumber, answer: answer });
                    }
                });
                if (whysForCause.length > 0) {
                    allWhysData.push({
                        feedback_id: feedbackId,
                        whys: whysForCause
                    });
                }
            });

            if (allWhysData.length === 0) {
                submissionMessageDiv.textContent = 'Please enter at least one "Why" for any cause before submitting.';
                submissionMessageDiv.style.setProperty('display', 'block', 'important');
                submissionMessageDiv.classList.remove('alert-success');
                submissionMessageDiv.classList.add('alert-danger');
                return;
            }

            try {
                const response = await fetch('/api/submit_all_whys', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ problem_id: problemId, all_whys_data: allWhysData }),
                });
                const data = await response.json();

                if (data.success) {
                    // Lock everything to show submitted state
                    lockAfterSubmission();

                } else {
                    alert('❌ Failed to submit: ' + data.error);
                    submissionMessageDiv.textContent = `Failed to submit whys: ${data.error}`;
                    submissionMessageDiv.style.display = 'block';
                    submissionMessageDiv.classList.remove('alert-success');
                    submissionMessageDiv.classList.add('alert-danger');
                }
            } catch (error) {
                console.error('Error submitting all whys:', error);
                alert('❌ Error: ' + error.message);
                submissionMessageDiv.textContent = 'An error occurred while submitting all whys.';
                submissionMessageDiv.style.display = 'block';
                submissionMessageDiv.classList.remove('alert-success');
                submissionMessageDiv.classList.add('alert-danger');
            }
        });
    }
});
