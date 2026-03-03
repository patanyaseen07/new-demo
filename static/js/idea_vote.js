/**
 * Fishbone RCA - Idea Voting Phase JavaScript
 * Handles timer display, idea voting selection, and submission
 */
document.addEventListener('DOMContentLoaded', () => {
    const config = window.FISHBONE_CONFIG;
    if (!config) return;

    // Timer Logic
    const timerEl = document.getElementById('phase-timer');
    let remainingSeconds = parseInt(timerEl?.dataset.remaining || '0');
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
                timerEl.dataset.remaining = remainingSeconds.toString();
                updateTimerDisplay();

                if (remainingSeconds <= 0) {
                    timerExpired = true;
                    lockSubmissions();
                }
            }

            // Admin Auto-Advance
            if (config.isAdmin && remainingSeconds <= 0 && !timerEl.dataset.submitting) {
                timerEl.dataset.submitting = "true";

                const params = new URLSearchParams();
                params.append('problem_id', config.problemId);
                params.append('next_phase', 'idea_results'); // Advance to idea results phase

                fetch(config.urls.startPhase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params
                }).then(() => {
                    window.location.href = window.location.origin + '/problem/' + config.problemId;
                }).catch(() => {
                    timerEl.dataset.submitting = "";
                });
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

                if (data.phase && data.phase !== 'idea_vote') {
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
        startTimer(); // Always start the timer if the element exists
    }

    // Start polling for users (if not admin)
    if (!config.isAdmin) {
        startPolling();
    }

    // Add more time (Admin only)
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
    let submissionsLocked = false;
    function lockSubmissions() {
        submissionsLocked = true;
        const btn = document.getElementById('submit-votes-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Time's Up";
        }
        document.querySelectorAll('.voting-item').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.6';
        });
    }

    // Lock immediately if page loads with 0 time
    if (timerExpired && timerEl) {
        lockSubmissions();
    }

    // Track selected votes
    let currentSelectedVotes = new Set();
    const voteLimit = config.voteLimit;
    const myInitialVotesCount = config.myVotesCount;

    // Initialize selected votes from already voted items if any
    document.querySelectorAll('.voting-item.voted').forEach(el => {
        currentSelectedVotes.add(el.dataset.id);
    });

    // Toggle Vote Selection
    window.toggleSelection = function (ideaId, el) {
        if (submissionsLocked) return; // Timer expired
        if (config.hasVoted) return; // If user has already submitted votes, prevent further interaction

        const isSelected = el.classList.contains('selected');
        const totalVotesAfterAction = myInitialVotesCount + (isSelected ? currentSelectedVotes.size - 1 : currentSelectedVotes.size + 1);

        if (!isSelected && totalVotesAfterAction > voteLimit) {
            // Prevent selection if it exceeds the limit
            alert(`You can only cast ${voteLimit} votes per problem. You have already selected ${currentSelectedVotes.size} items and cast ${myInitialVotesCount} votes.`);
            return;
        }

        el.classList.toggle('selected');
        // CSS will now handle the visibility and animation based on the 'selected' and 'voted' classes.
        // We need to update a data attribute to control the number of dots.

        if (el.classList.contains('selected')) {
            currentSelectedVotes.add(ideaId);
        } else {
            currentSelectedVotes.delete(ideaId);
        }
        // CSS will handle the visibility of the single dot based on the 'selected' class.
        // No need for data-votes attribute or direct style manipulation for dots/checkmark here.

        updateSubmitButton();
    };

    function updateSubmitButton() {
        const btn = document.getElementById('submit-votes-btn');
        if (btn) {
            const totalSelected = currentSelectedVotes.size;
            const remainingVotes = voteLimit - myInitialVotesCount - totalSelected;

            btn.disabled = totalSelected === 0 || remainingVotes < 0;
            if (totalSelected === 0) {
                btn.innerText = 'Select Votes';
            } else if (remainingVotes < 0) {
                btn.innerText = `Too Many Votes (${totalSelected} / ${voteLimit - myInitialVotesCount})`;
            } else {
                btn.innerText = `Submit ${totalSelected} Vote${totalSelected === 1 ? '' : 's'}`;
            }

            // Display vote count/limit
            const voteCountDisplay = document.getElementById('vote-count-display');
            if (voteCountDisplay) {
                voteCountDisplay.innerText = `${myInitialVotesCount + totalSelected} / ${voteLimit} votes`;
                if (myInitialVotesCount + totalSelected > voteLimit) {
                    voteCountDisplay.style.color = 'var(--accent-color)'; // Indicate over limit
                } else {
                    voteCountDisplay.style.color = 'var(--primary-color)';
                }
            }
        }
    }

    // Submit Votes
    window.submitVotes = async function () {
        const ids = Array.from(currentSelectedVotes);

        if (ids.length === 0) return;

        const btn = document.getElementById('submit-votes-btn');
        const originalBtnText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Submitting...";

        try {
            const res = await fetch(config.urls.vote, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea_ids: ids }) // Changed from feedback_ids to idea_ids
            });

            const data = await res.json();

            if (res.ok) {
                window.location.reload();
            } else {
                const errorMessage = data.error || "Error submitting votes.";
                alert(errorMessage);
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
        } catch (e) {
            alert("Network error. Please check your connection and try again.");
            btn.disabled = false;
            btn.innerText = originalBtnText;
        }
    };

    // Initial update of the submit button and vote count display
    updateSubmitButton();
});
