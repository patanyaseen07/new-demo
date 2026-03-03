/**
 * Fishbone RCA - Global JavaScript
 * Handles phase change polling
 */
document.addEventListener('DOMContentLoaded', () => {

    // Note: Timer logic has been moved to phase templates to support AJAX extensions properly.
    // main.js will now only handle global ui interactions.

    // Reusable function to update a single timer display
    window.updateTimerDisplay = function (timerElement) {
        let remaining = parseInt(timerElement.dataset.remaining);
        if (remaining > 0) {
            remaining--;
            timerElement.dataset.remaining = remaining;
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (remaining <= 0) {
                // Refresh page when timer expires
                window.location.reload();
            }
        } else if (remaining === 0) {
            // If timer already at 0, ensure it stays at 00:00 and triggers reload
            timerElement.textContent = `0:00`;
            window.location.reload();
        }
    };

    // Auto-Reload on Phase Change
    // We look for a meta tag or data attribute defining the current phase to compare against
    const currentPhase = document.body.dataset.phase;
    const problemId = document.body.dataset.problemId;

    if (currentPhase && problemId) {
        setInterval(async () => {
            try {
                const res = await fetch(`/api/problem/${problemId}/status`);
                const data = await res.json();

                if (data.phase && data.phase !== currentPhase) {
                    window.location.reload();
                }
            } catch (e) {
                // Silent fail for polling
            }
        }, 3000); // Check every 3 seconds
    }
});
