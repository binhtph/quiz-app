// ===== SSE Record Ticker =====
// This file should be included in all pages to show record notifications

(function () {
    let tickerContainer = null;
    let tickerTimeout = null;

    // Create ticker element
    function createTicker() {
        if (document.getElementById('record-ticker')) return;

        const ticker = document.createElement('div');
        ticker.id = 'record-ticker';
        ticker.className = 'record-ticker hidden';
        ticker.innerHTML = `
      <div class="ticker-content">
        <span class="ticker-icon">🏆</span>
        <span class="ticker-text" id="ticker-text"></span>
      </div>
    `;
        document.body.insertBefore(ticker, document.body.firstChild);
        tickerContainer = ticker;
    }

    // Show ticker with message
    function showTicker(message, isPersonal = false) {
        if (!tickerContainer) createTicker();

        const textEl = document.getElementById('ticker-text');
        textEl.textContent = message;

        tickerContainer.classList.remove('hidden');
        tickerContainer.classList.toggle('personal', isPersonal);

        // Clear previous timeout
        if (tickerTimeout) clearTimeout(tickerTimeout);

        // Hide after 30 seconds
        tickerTimeout = setTimeout(() => {
            tickerContainer.classList.add('hidden');
        }, 30000);
    }

    // Initialize SSE connection
    function initRecordSSE() {
        const eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'new_record') {
                const minutes = Math.floor(data.time_taken / 60);
                const seconds = data.time_taken % 60;
                const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

                // Check if this is the current user
                const currentUser = localStorage.getItem('userName');
                const isPersonal = currentUser && currentUser === data.user_name;

                let message;
                if (isPersonal) {
                    message = `🎉 Chúc mừng! Bạn đã lập kỷ lục mới: ${data.score}/${data.total} (${data.percentage}%) - ${data.exam_title} • Thời gian: ${timeStr}`;
                } else {
                    message = `${data.user_name} vừa lập kỷ lục mới: ${data.score}/${data.total} (${data.percentage}%) trong bài "${data.exam_title}" • Thời gian: ${timeStr}`;
                }

                showTicker(message, isPersonal);
            }
        };

        eventSource.onerror = () => {
            // Reconnect after 5 seconds
            eventSource.close();
            setTimeout(initRecordSSE, 5000);
        };
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createTicker();
            initRecordSSE();
        });
    } else {
        createTicker();
        initRecordSSE();
    }

    // Expose for manual triggering (e.g., from result page)
    window.showRecordTicker = showTicker;
})();
