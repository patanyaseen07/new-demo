
document.addEventListener('DOMContentLoaded', () => {
    const config = window.FISHBONE_CONFIG || {}; // Ensure config exists
    const startDeepDiveBtn = document.getElementById('startDeepDiveBtn');
    const selectableCauseItems = document.querySelectorAll('.selectable-cause');
    // problemId is now available via config.problemId

    const DEEP_DIVE_MIN_SELECTION = 1;
    const DEEP_DIVE_MAX_SELECTION = 2; // Admin can select 1 or 2 causes
    const deepDiveSelectionInfo = document.getElementById('deep-dive-selection-info');
    let selectedFeedbackIds = new Set(); // Use a Set to store unique IDs

    function updateDeepDiveSelectionUI() {
        if (deepDiveSelectionInfo) {
            const currentCount = selectedFeedbackIds.size;
            deepDiveSelectionInfo.textContent = `Selected ${currentCount} / ${DEEP_DIVE_MAX_SELECTION} causes for Deep Dive.`;
            if (currentCount >= DEEP_DIVE_MIN_SELECTION && currentCount <= DEEP_DIVE_MAX_SELECTION) {
                deepDiveSelectionInfo.style.color = 'var(--success-color)';
            } else {
                deepDiveSelectionInfo.style.color = 'var(--text-muted)';
            }
        }
        if (startDeepDiveBtn) {
            startDeepDiveBtn.disabled = !(selectedFeedbackIds.size >= DEEP_DIVE_MIN_SELECTION && selectedFeedbackIds.size <= DEEP_DIVE_MAX_SELECTION);
        }
    }

    // Event listener for selectable cause items
    selectableCauseItems.forEach(item => {
        item.addEventListener('click', (event) => {
            const feedbackId = item.dataset.feedbackId;
            if (selectedFeedbackIds.has(feedbackId)) {
                selectedFeedbackIds.delete(feedbackId);
                item.classList.remove('selected');
            } else {
                if (selectedFeedbackIds.size < DEEP_DIVE_MAX_SELECTION) {
                    selectedFeedbackIds.add(feedbackId);
                    item.classList.add('selected');
                } else {
                    alert(`You can select a maximum of ${DEEP_DIVE_MAX_SELECTION} causes for the deep dive.`);
                }
            }
            updateDeepDiveSelectionUI();
        });
    });

    if (startDeepDiveBtn) {
        startDeepDiveBtn.addEventListener('click', async () => {
            const feedbackIdsArray = Array.from(selectedFeedbackIds);

            if (!(feedbackIdsArray.length >= DEEP_DIVE_MIN_SELECTION && feedbackIdsArray.length <= DEEP_DIVE_MAX_SELECTION)) {
                alert(`Please select 1 or 2 causes for the deep dive.`);
                return;
            }

            try {
                const response = await fetch(config.urls.startDeepDive, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ problem_id: config.problemId, feedback_ids: feedbackIdsArray }),
                });
                const data = await response.json();
                if (data.success) {
                    window.location.href = data.redirect_url;
                } else {
                    alert(`Failed to start deep dive: ${data.error}`);
                    console.error('Failed to start deep dive:', data.error);
                }
            } catch (error) {
                console.error('Error starting deep dive:', error);
                alert('An error occurred while starting the deep dive.');
            }
        });
    }

    // Polling for Users
    function startPolling() {
        if (config.isAdmin) return;

        setInterval(async function () {
            try {
                const response = await fetch(config.urls.status);
                const data = await response.json();

                if (data.phase && data.phase !== 'result') {
                    window.location.href = window.location.origin + '/problem/' + config.problemId;
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 5000); // Poll every 5 seconds
    }

    // Initial UI update
    updateDeepDiveSelectionUI();


    // Start polling for users (if not admin)
    if (!config.isAdmin) {
        startPolling();
    }
});

function downloadDiagram() {
    const diagramNode = document.querySelector('.fishbone-wrapper');
    const btn = document.querySelector('button[title="Download Image"]');

    if (!btn || !diagramNode) return;

    // Visual feedback
    const originalHtml = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    html2canvas(diagramNode, {
        backgroundColor: '#ffffff',
        scale: 2, // Retina quality
        logging: false,
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `fishbone-diagram-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset button
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }).catch(err => {
        console.error('Export failed:', err);
        alert('Could not export image. Try using the browser Print function.');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });
}
