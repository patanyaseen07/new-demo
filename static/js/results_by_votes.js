// Global variable to store problem ID
let problemId = null;

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function() {
    problemId = getProblemIdFromUrl();
    
    if (problemId) {
        fetchResultsByVotes(problemId);
    } else {
        showError('Problem ID not found in URL.');
    }
});

// ========== URL Parsing ==========
function getProblemIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1] || null;
}

// ========== API Call ==========
function fetchResultsByVotes(problemId) {
    showLoading();

    fetch(`/api/results_by_votes/${problemId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showError(data.error);
            } else {
                displayResults(data);
            }
        })
        .catch(error => {
            console.error('Error fetching results:', error);
            showError('Failed to load results. Please try again.');
        });
}

// ========== Display Results ==========
function displayResults(results) {
    hideLoading();

    const container = document.getElementById('results-container');
    const emptyContainer = document.getElementById('empty-container');

    // Handle empty results
    if (!results || results.length === 0) {
        emptyContainer.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }

    // Sort by votes (descending)
    results.sort((a, b) => b.votes - a.votes);

    // Clear and show container
    container.innerHTML = '';
    container.classList.remove('hidden');
    emptyContainer.classList.add('hidden');

    // Create result cards
    results.forEach((result, index) => {
        const card = createResultCard(result, index + 1);
        container.appendChild(card);
    });
}

// ========== Create Result Card ==========
function createResultCard(result, rank) {
    const card = document.createElement('div');
    card.className = 'result-card';

    // Rank Badge
    const rankBadge = document.createElement('div');
    rankBadge.className = `rank-badge ${getRankClass(rank)}`;
    rankBadge.textContent = rank;

    // Content
    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('h3');
    title.textContent = result.title || 'Untitled Idea';

    const description = document.createElement('p');
    description.textContent = result.description || 'No description available.';

    content.appendChild(title);
    content.appendChild(description);

    // Vote Count
    const voteCount = document.createElement('div');
    voteCount.className = 'vote-count';

    const voteNumber = document.createElement('span');
    voteNumber.className = 'vote-number';
    voteNumber.textContent = result.votes || 0;

    const voteLabel = document.createElement('span');
    voteLabel.className = 'vote-label';
    voteLabel.textContent = result.votes === 1 ? 'Vote' : 'Votes';

    voteCount.appendChild(voteNumber);
    voteCount.appendChild(voteLabel);

    // Assemble Card
    card.appendChild(rankBadge);
    card.appendChild(content);
    card.appendChild(voteCount);

    return card;
}

// ========== Get Rank Class ==========
function getRankClass(rank) {
    switch (rank) {
        case 1: return 'rank-1';
        case 2: return 'rank-2';
        case 3: return 'rank-3';
        default: return 'rank-other';
    }
}

// ========== State Management ==========
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('error-container').classList.add('hidden');
    document.getElementById('empty-container').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    hideLoading();
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-container').classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('empty-container').classList.add('hidden');
}

// ========== Retry Function ==========
function retryFetch() {
    if (problemId) {
        fetchResultsByVotes(problemId);
    } else {
        showError('Problem ID not found. Please go back and try again.');
    }
}