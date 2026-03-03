/**
 * Pareto Chart Page JavaScript
 * Handles timer, chart rendering, and interactions
 */

(function() {
    'use strict';

    // ========== Configuration ==========
    const configEl = document.getElementById('config-data');
    const CONFIG = {
        problemId: configEl.dataset.problemId,
        isAdmin: configEl.dataset.isAdmin === 'true',
        urlExtend: configEl.dataset.urlExtend,
        remainingTime: parseInt(configEl.dataset.remainingTime || '0'),
        paretoData: JSON.parse(configEl.dataset.paretoData || '[]'),
        urlStatus: configEl.dataset.urlStatus // Add status URL
    };

    // ========== DOM Elements ==========
    const elements = {
        timer: document.getElementById('phase-timer'),
        addTimeBtn: document.getElementById('add-time-btn'),
        chart: document.getElementById('paretoChart'),
        totalVotes: document.getElementById('total-votes'),
        exportBtn: document.getElementById('export-btn'),
        table: document.getElementById('pareto-table')
    };

    // ========== State ==========
    let remainingSeconds = CONFIG.remainingTime;
    let timerInterval = null;
    let chartInstance = null;
    let dataPollingInterval = null; // New: for live data polling

    // ========== Timer Functions ==========
    function formatTime(totalSeconds) {
        const seconds = Math.floor(totalSeconds); // Ensure seconds is an integer
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateTimerDisplay() {
        if (elements.timer) {
            elements.timer.textContent = formatTime(remainingSeconds);
            
            // Add warning class when time is low
            if (remainingSeconds <= 60) {
                elements.timer.parentElement.classList.add('timer-warning');
            } else {
                elements.timer.parentElement.classList.remove('timer-warning');
            }
        }
    }

    function startTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        updateTimerDisplay();

        timerInterval = setInterval(function() {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                handleTimerEnd();
            }
        }, 1000);
    }

    function handleTimerEnd() {
        if (elements.timer) {
            elements.timer.textContent = "0:00";
            elements.timer.parentElement.classList.add('timer-ended');
        }
        // Do NOT stop polling here. Polling is needed to detect admin phase changes.
    }

    // ========== Live Data Polling Functions ==========
    async function fetchDataAndUpdateChart() {
        try {
            const response = await fetch(CONFIG.urlStatus); // Use the generic status URL
            const data = await response.json();

            if (response.ok) { // Removed data.success check as it's now included in the response
                // If the server's current phase is different from the client's current phase, redirect to the base problem URL
                if (data.phase && data.phase !== 'pareto_view') {
                    window.location.href = window.location.origin + '/problem/' + CONFIG.problemId;
                    return; // Stop further processing if redirected
                }

                // Only update chart data if still in the correct phase
                const paretoDataResponse = await fetch(`/api/pareto_data/${CONFIG.problemId}`);
                const paretoData = await paretoDataResponse.json();

                if (paretoDataResponse.ok && paretoData.success) {
                    CONFIG.paretoData = paretoData.pareto_data;
                    remainingSeconds = paretoData.remaining_time; // Update timer from server
                    updateTimerDisplay();
                    renderChart(); // Re-render chart with new data
                    updateTable(paretoData.pareto_data); // Update table with new data
                    if (elements.totalVotes) {
                        elements.totalVotes.textContent = paretoData.total_votes;
                    }
                    if (document.getElementById('participant-count')) {
                        document.getElementById('participant-count').textContent = paretoData.participants;
                    }
                    // Update live badge if status changes
                    const liveBadge = document.querySelector('.live-badge');
                    if (liveBadge) {
                        if (paretoData.is_live) {
                            liveBadge.style.display = 'inline-flex';
                        } else {
                            liveBadge.style.display = 'none';
                        }
                    }
                } else {
                    console.error('Failed to fetch live Pareto data:', paretoData.error || 'Unknown error');
                }
            } else {
                console.error('Failed to fetch problem status:', data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching live Pareto data or status:', error);
        }
    }

    function startDataPolling() {
        if (dataPollingInterval) {
            clearInterval(dataPollingInterval);
        }
        // Poll every 5 seconds
        dataPollingInterval = setInterval(fetchDataAndUpdateChart, 5000);
    }

    function stopDataPolling() {
        // This function is no longer called by handleTimerEnd, but kept for potential future use.
        if (dataPollingInterval) {
            clearInterval(dataPollingInterval);
            dataPollingInterval = null;
        }
    }

    function updateTable(newData) {
        const tbody = elements.table ? elements.table.querySelector('tbody') : null;
        if (!tbody) return;

        let html = '';
        let totalVotes = 0;
        newData.forEach((item, index) => {
            totalVotes += item.vote_count;
            html += `
                <tr data-votes="${item.vote_count}" data-cumulative="${item.cumulative_percentage}">
                    <td class="rank-col">${index + 1}</td>
                    <td>${item.why_text}</td>
                    <td class="num-col">${item.vote_count}</td>
                    <td class="num-col">${item.percentage}%</td>
                    <td class="num-col">
                        <div class="cumulative-bar">
                            <div class="bar-fill" style="width: ${item.cumulative_percentage}%"></div>
                            <span>${item.cumulative_percentage}%</span>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (elements.totalVotes) {
            elements.totalVotes.textContent = totalVotes;
        }
        setupRowHighlighting(); // Re-apply highlighting after table update
    }

    // ========== Add Time Function ==========
    async function addMoreTime() {
        const btn = elements.addTimeBtn;
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Adding...';

        try {
            const response = await fetch(CONFIG.urlExtend, {
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

            if (response.ok && data.success) {
                remainingSeconds = data.new_remaining_seconds;
                updateTimerDisplay();
                
                btn.innerHTML = '✓ Added 10 min';
                btn.classList.add('btn-success');
                
                setTimeout(function() {
                    btn.innerHTML = originalText;
                    btn.classList.remove('btn-success');
                    btn.disabled = false;
                }, 2000);
            } else {
                throw new Error(data.error || 'Failed to add time');
            }
        } catch (error) {
            console.error('Error adding time:', error);
            
            btn.innerHTML = '✗ Error';
            btn.classList.add('btn-error');
            
            setTimeout(function() {
                btn.innerHTML = originalText;
                btn.classList.remove('btn-error');
                btn.disabled = false;
            }, 2000);
        }
    }

    // ========== Chart Functions ==========
    function getChartColors(count, ctx) {
        const gradientColors = [];
        for (let i = 0; i < count; i++) {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400); // Vertical gradient
            gradient.addColorStop(0, 'rgba(96, 165, 250, 0.8)'); // Lighter blue at top
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.8)'); // Darker blue at bottom
            gradientColors.push(gradient);
        }
        return gradientColors;
    }

    function truncateLabel(label, maxLength) {
        if (label.length <= maxLength) return label;
        return label.substring(0, maxLength - 3) + '...';
    }

    function renderChart() {
        if (!elements.chart || CONFIG.paretoData.length === 0) {
            return;
        }

        const ctx = elements.chart.getContext('2d');
        const data = CONFIG.paretoData;

        // Calculate total votes and max vote count for Y-axis scaling
        const totalVotes = data.reduce((sum, item) => sum + item.vote_count, 0);
        const maxVoteCount = data.length > 0 ? Math.max(...data.map(item => item.vote_count)) : 0;
        let yAxisMax = Math.ceil((maxVoteCount + 1) / 5) * 5;
        if (yAxisMax === 0 && maxVoteCount === 0) { // Handle case with no votes
            yAxisMax = 5;
        } else if (yAxisMax < maxVoteCount + 1) { // Ensure max is always above highest data point
            yAxisMax = Math.ceil((maxVoteCount + 1) / 5) * 5;
            if (yAxisMax <= maxVoteCount) { // If still not enough, add another 5
                yAxisMax += 5;
            }
        }

        let yAxisStepSize = 5;
        if (yAxisMax <= 5) {
            yAxisStepSize = 1;
        } else if (yAxisMax <= 10) {
            yAxisStepSize = 2;
        }

        if (elements.totalVotes) {
            elements.totalVotes.textContent = totalVotes;
        }

        // Prepare chart data
        const labels = data.map(item => truncateLabel(item.why_text, 35));
        const votes = data.map(item => item.vote_count);
        const cumulative = data.map(item => item.cumulative_percentage);
        const colors = getChartColors(data.length, ctx); // Pass ctx to getChartColors

        // Destroy existing chart if any
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Register datalabels plugin if not already registered
        if (typeof ChartDataLabels === 'undefined') {
            console.warn('ChartDataLabels plugin not found. Please ensure it is loaded.');
        } else {
            Chart.register(ChartDataLabels);
        }

        // Register annotation plugin if not already registered
        if (typeof ChartjsPluginAnnotation === 'undefined') {
            console.warn('ChartjsPluginAnnotation plugin not found. Please ensure it is loaded.');
        } else {
            Chart.register(ChartjsPluginAnnotation);
        }

        // Create new chart
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Votes',
                        data: votes,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c),
                        borderWidth: 1,
                        borderRadius: 6,
                        order: 2,
                        yAxisID: 'y',
                        datalabels: { // Datalabels configuration for this dataset
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            formatter: function(value) {
                                return value;
                            },
                            font: {
                                weight: 'bold',
                                size: 10
                            },
                            color: '#333'
                        }
                    },
                    {
                        label: 'Cumulative %',
                        data: cumulative,
                        type: 'line',
                        borderColor: '#E11937',
                        backgroundColor: 'rgba(225, 25, 55, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: '#E11937',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: false,
                        tension: 0.3,
                        order: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Total no. of votes for each cause',
                        position: 'top',
                        align: 'center',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                return CONFIG.paretoData[index].why_text;
                            },
                            label: function(context) {
                                if (context.dataset.label === 'Votes') {
                                    return `Votes: ${context.raw}`;
                                } else {
                                    return `Cumulative: ${context.raw}%`;
                                }
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: function(value, context) {
                            if (context.dataset.label === 'Votes') {
                                return value;
                            }
                            return null;
                        },
                        font: {
                            weight: 'bold',
                            size: 10
                        },
                        color: '#333'
                    },
                    annotation: { // Add annotation plugin configuration
                        annotations: {
                            pareto80Line: { // Define a unique ID for the annotation
                                type: 'line',
                                yMin: 80,
                                yMax: 80,
                                yScaleID: 'y1',
                                borderColor: 'rgba(239, 68, 68, 0.7)',
                                borderWidth: 2,
                                borderDash: [6, 4],
                                label: {
                                    display: true,
                                    content: '80% Line',
                                    position: 'end',
                                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                    color: '#fff',
                                    font: { size: 10 }
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false // Disable vertical grid lines
                        },
                        ticks: {
                            maxRotation: 0, // Set rotation to 0 degrees
                            minRotation: 0,
                            font: { size: 11 },
                            color: '#333', // Darken X-axis ticks color
                            autoSkip: false, // Prevent auto-skipping labels
                            callback: function(value, index, ticks) {
                                // Implement text wrapping for X-axis labels
                                const label = CONFIG.paretoData[index].why_text;
                                const maxLength = 20; // Max characters per line
                                const words = label.split(' ');
                                let lines = [];
                                let currentLine = '';

                                words.forEach(word => {
                                    if ((currentLine + word).length > maxLength) {
                                        lines.push(currentLine.trim());
                                        currentLine = word + ' ';
                                    } else {
                                        currentLine += word + ' ';
                                    }
                                });
                                lines.push(currentLine.trim());
                                return lines;
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        max: yAxisMax, // Set fixed maximum limit
                        title: {
                            display: true,
                            text: 'Vote Count',
                            font: { size: 12, weight: '600' },
                            color: '#000' // Darken Y-axis title color
                        },
                        ticks: {
                            precision: 0,
                            stepSize: yAxisStepSize, // Dynamic tick intervals
                            font: { size: 11 },
                            color: '#333' // Darken Y-axis ticks color
                        },
                        borderColor: '#333', // For the axis line itself (including zero line)
                        borderWidth: 2,
                        grid: {
                            display: true, // Enable horizontal grid lines
                            color: '#e0e0e0', // Very light grey color
                            lineWidth: 1, // Thin border width
                            drawOnChartArea: true,
                            drawTicks: false,
                            drawBorder: false, // This should be false if borderColor/borderWidth are on the scale
                            z: 0 // Ensure grid lines are behind bars
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Cumulative %',
                            font: { size: 12, weight: '600' },
                            color: '#000' // Darken Y1-axis title color
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            stepSize: 10, // Tick marks at 10% intervals
                            font: { size: 11 },
                            color: '#333' // Darken Y1-axis ticks color
                        },
                        borderColor: '#333', // For the axis line itself
                        borderWidth: 2,
                        grid: {
                            drawOnChartArea: false,
                            z: 0 // Ensure grid lines are behind cumulative line
                        }
                    }
                }
            }
        });

        // Adjust Pareto line to start at the top of the first bar
        if (chartInstance.data.datasets[1].data.length > 0) {
            chartInstance.data.datasets[1].data[0] = data[0].cumulative_percentage;
            chartInstance.update();
        }
    }

    // ========== Export Function ==========
    function exportTableToCSV() {
        if (!elements.table) return;

        const rows = elements.table.querySelectorAll('tr');
        const csvContent = [];

        rows.forEach(function(row) {
            const cols = row.querySelectorAll('th, td');
            const rowData = [];
            
            cols.forEach(function(col) {
                let text = col.textContent.trim();
                // Escape quotes and wrap in quotes if contains comma
                if (text.includes(',') || text.includes('"')) {
                    text = '"' + text.replace(/"/g, '""') + '"';
                }
                rowData.push(text);
            });
            
            csvContent.push(rowData.join(','));
        });

        const csv = csvContent.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'pareto_analysis_' + CONFIG.problemId + '.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ========== Row Highlighting ==========
    function setupRowHighlighting() {
        if (!elements.table) return;

        const rows = elements.table.querySelectorAll('tbody tr');
        
        rows.forEach(function(row, index) {
            row.addEventListener('mouseenter', function() {
                highlightChartBar(index, true);
            });
            
            row.addEventListener('mouseleave', function() {
                highlightChartBar(index, false);
            });
        });
    }

    function highlightChartBar(index, highlight) {
        if (!chartInstance) return;

        const dataset = chartInstance.data.datasets[0];
        const originalColors = getChartColors(CONFIG.paretoData.length, elements.chart.getContext('2d')); // Store original colors
        
        if (highlight) {
            dataset.backgroundColor = originalColors.map((c, i) => 
                i === index ? c : 'rgba(96, 165, 250, 0.3)' // Use a semi-transparent solid color for dimmed bars
            );
        } else {
            dataset.backgroundColor = originalColors; // Revert to original colors
        }
        chartInstance.update(); // Update chart to reflect color changes
    }

    // The hexToRgba function is no longer needed as we are using rgba directly.
    // function hexToRgba(hex, alpha) {
    //     const r = parseInt(hex.slice(1, 3), 16);
    //     const g = parseInt(hex.slice(3, 5), 16);
    //     const b = parseInt(hex.slice(5, 7), 16);
    //     return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    // }

    // ========== 80/20 Line ==========
    function addParetoLine() {
        if (!chartInstance) return;

        // Add 80% reference line
        const annotation = {
            type: 'line',
            yMin: 80,
            yMax: 80,
            yScaleID: 'y1',
            borderColor: 'rgba(239, 68, 68, 0.7)',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
                display: true,
                content: '80% Line',
                position: 'end',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: '#fff',
                font: { size: 10 }
            }
        };

        // Note: This requires chartjs-plugin-annotation
        // For simplicity, we'll skip this if the plugin isn't loaded
        // If chartjs-plugin-annotation is loaded, add the annotation
        if (chartInstance.options.plugins.annotation) {
            chartInstance.options.plugins.annotation.annotations.push(annotation);
            chartInstance.update();
        } else {
            console.warn('chartjs-plugin-annotation not loaded. 80% line will not be displayed.');
        }
    }

    // ========== Initialization ==========
    function init() {
        // Start timer
        startTimer();

        // Start live data polling
        startDataPolling();

        // Render chart
        renderChart();

        // Setup event listeners
        if (elements.addTimeBtn) {
            elements.addTimeBtn.addEventListener('click', addMoreTime);
        }

        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportTableToCSV);
        }

        // Setup row highlighting
        setupRowHighlighting();

        // Add Pareto line if plugin is available
        addParetoLine();

    }

    // ========== Start ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
          init();
    }

    // Expose functions globally if needed
    window.ParetoChart = {
        addMoreTime: addMoreTime,
        exportData: exportTableToCSV,
        refresh: renderChart
    };

})();
