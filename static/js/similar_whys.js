document.addEventListener('DOMContentLoaded', () => {
    // Timer functionality (reused from collect.js/vote.js for consistency)
    const config = window.FISHBONE_CONFIG || {}; // Ensure config exists
    const timerEl = document.getElementById('phase-timer'); // Changed from 'timer' to 'phase-timer' for consistency
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

        setInterval(async function() {
            try {
                const response = await fetch(config.urls.status);
                const data = await response.json();

                // If the server's current phase is different from the client's current phase, redirect to the base problem URL
                if (data.phase && data.phase !== 'similar_whys') {
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

    // Admin: Add more time functionality
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
                alert(data.error || "Error adding time.");
                btn.innerText = "Error";
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }, 1500);
            }
        } catch (e) {
            console.error('Network error adding time:', e);
            alert("Network error. Please check your connection and try again.");
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

    // Dot Voting logic for Similar Whys (Phase 5)
    const similarWhysContentWrapper = document.getElementById('similarWhysContentWrapper');
    if (similarWhysContentWrapper && currentPhase === 'similar_whys') { // currentPhase is hardcoded in the template
        let currentSelectedVotes = new Set();
        const voteLimit = config.similarWhyVoteLimit;
        const myInitialVotesCount = config.mySimilarWhyVotesCount;
        const hasVoted = myInitialVotesCount > 0;

        // Initialize selected votes from already voted items if any
        document.querySelectorAll('.voting-item.voted').forEach(el => {
            currentSelectedVotes.add(el.dataset.id);
        });

        // Toggle Vote Selection
        window.toggleSelection = function (whyText, el) {
            if (submissionsLocked) return; // Timer expired
            if (hasVoted) {
                return; // If user has already submitted votes, prevent further interaction
            }

            const isSelected = el.classList.contains('selected');
            const totalVotesAfterAction = myInitialVotesCount + (isSelected ? currentSelectedVotes.size - 1 : currentSelectedVotes.size + 1);

            if (!isSelected && totalVotesAfterAction > voteLimit) {
                alert(`You can only cast ${voteLimit} votes per problem. You have already selected ${currentSelectedVotes.size} items and cast ${myInitialVotesCount} votes.`);
                return;
            }

            el.classList.toggle('selected');
            if (el.classList.contains('selected')) {
                currentSelectedVotes.add(whyText);
            } else {
                currentSelectedVotes.delete(whyText);
            }
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

                const voteCountDisplay = document.getElementById('vote-count-display');
                if (voteCountDisplay) {
                    voteCountDisplay.innerText = `${myInitialVotesCount + totalSelected} / ${voteLimit} votes selected.`;
                    if (myInitialVotesCount + totalSelected > voteLimit) {
                        voteCountDisplay.style.color = 'var(--accent-color)';
                    } else {
                        voteCountDisplay.style.color = 'var(--deep-evergreen)';
                    }
                }
            }
        }

        // Submit Votes
        window.submitVotes = async function () {
            const whyTextsToVote = Array.from(currentSelectedVotes);

            if (whyTextsToVote.length === 0) {
                return;
            }

            const btn = document.getElementById('submit-votes-btn');
            const originalBtnText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Submitting...";

            try {
                const response = await fetch('/api/vote_similar_whys_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ problem_id: problemId, why_texts: whyTextsToVote })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    window.location.reload();
                } else {
                    alert(`Failed to submit votes: ${data.error || "Unknown error"}`);
                    btn.disabled = false;
                    btn.innerText = originalBtnText;
                }
            } catch (e) {
                console.error('Network error submitting votes:', e);
                alert("Network error. Please check your connection and try again.");
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
        };

        updateSubmitButton(); // Initial update
    }
});
