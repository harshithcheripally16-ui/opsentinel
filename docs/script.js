document.addEventListener('DOMContentLoaded', () => {
    /* --- State Management --- */
    const metricCache = {
        cpu: { text: null, bar: null, last: null },
        memory: { text: null, bar: null, last: null },
        disk: { text: null, bar: null, last: null }
    };

    // --- Demo Mode Support ---
    const isDemo = window.location.hostname.includes('github.io') || 
                   window.location.protocol === 'file:' || 
                   window.location.pathname.includes('/docs/');

    function getColor(value) {
        if (value < 50) return '#4ade80'; // accent-green
        if (value <= 80) return '#fbbf24'; // accent-amber
        return '#ef4444'; // accent-red
    }

function getMetricColor(prefix) {
    const colors = {
        'cpu': '#3b82f6',
        'memory': '#f97316',
        'disk': '#22c55e'
    };
    return colors[prefix] || '#94a3b8';
}

function animateNumber(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        element.textContent = Math.floor(progress * (end - start) + start) + '%';
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

let initialLoadDone = false;
function hidePreloader() {
    if (initialLoadDone) return;
    initialLoadDone = true;
    
    const preloader = document.getElementById('preloader');
    if (preloader) {
        console.log('[Opsentinel Trace] Preloader dismissal triggered.');
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 500);
    }
    
    // Trigger entrance animations exactly once
    if (typeof initScrollAnimations === 'function') {
        initScrollAnimations();
    }
}

// Failsafe: Hide preloader after 2s even if metrics take long
setTimeout(hidePreloader, 2000);

function updateMetricData(prefix, value) {
    // Cache lookup on first run
    if (!metricCache[prefix].text) {
        metricCache[prefix].text = document.getElementById(`${prefix}-value`);
        metricCache[prefix].bar = document.getElementById(`${prefix}-bar`);
    }

    const cache = metricCache[prefix];
    if (!cache.text || !cache.bar) return;

    // Optimization: Skip DOM updates if value hasn't changed
    if (cache.last === value) return;
    
    // Animate from last value to new value
    animateNumber(cache.text, cache.last || 0, value, 800);
    cache.last = value;

    cache.bar.style.width = `${value}%`;
    
    // Use fixed identity color for bars/text to match SaaS identity
    const color = getMetricColor(prefix);
    cache.text.style.color = color;
    cache.bar.style.backgroundColor = color;
}

function setOfflineUI() {
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.textContent = "Server Connection Lost";
        subtitle.style.color = "var(--accent-red)";
    }

    ['cpu', 'memory', 'disk'].forEach(prefix => {
        const cache = metricCache[prefix];
        // Ensure cache is populated
        if (!cache.text) updateMetricData(prefix, 0); 
        
        if (cache.text && cache.bar) {
            cache.text.textContent = '---';
            cache.text.style.color = 'var(--text-muted)';
            cache.bar.style.width = '0%';
        }
    });
}

function setOnlineUI() {
    const subtitle = document.querySelector('.subtitle');
    if (subtitle && subtitle.textContent === "Server Connection Lost") {
        subtitle.textContent = "Real-Time Server Health Monitor";
        subtitle.style.color = "var(--text-secondary)";
    }
}

function updateMetrics() {
    let data = null;
    try {
        console.log('[Opsentinel Trace] Simulation: Generating telemetry batch...');
        // STANDALONE DEMO: Realistic metric simulation (drifting)
        const drift = (val, min, max) => {
            const change = (Math.random() * 10) - 5; // -5% to +5%
            return Math.floor(Math.max(min, Math.min(max, (val || (min + max) / 2) + change)));
        };

        data = {
            cpu: drift(metricCache.cpu.last, 10, 90),
            memory: drift(metricCache.memory.last, 30, 85),
            disk: drift(metricCache.disk.last, 40, 50)
        };
        
        if (!data) throw new Error("Simulation engine failed to generate data.");
        
        setOnlineUI();
        
        updateMetricData('cpu', data.cpu);
        updateMetricData('memory', data.memory);
        updateMetricData('disk', data.disk);
        updateChartLabels();
        updateChart('cpu', data.cpu);
        updateChart('memory', data.memory);
        updateChart('disk', data.disk);
        
        evaluateLogs(data);
        updateAlertBanner(data);
        console.log('[Opsentinel Trace] Simulation: Telemetry generation complete.');
    } catch (error) {
        console.error('[Opsentinel Trace] Simulation failure, using fallback data:', error);
        data = generateMockData(); // Deep fallback
        setOfflineUI();
    } finally {
        hidePreloader();
        
        // Pacing: Schedule next update only after current one finishes
        const rate = 2500; 
        setTimeout(updateMetrics, rate);
    }
}

async function fetchSystemInfo() {
    try {
        console.log('[Opsentinel Trace] Simulation: Loading system information...');
        
        // Standalone simulation doesn't use real fetch
        const data = {
            os: "Linux Distributed Node",
            hostname: "demo-hub-01",
            cores: 8
        };
        
        const osEl = document.getElementById('info-os');
        const hostnameEl = document.getElementById('info-hostname');
        const coresEl = document.getElementById('info-cores');
        
        if (osEl) osEl.textContent = data.os;
        if (hostnameEl) hostnameEl.textContent = data.hostname;
        if (coresEl) coresEl.textContent = data.cores;
        
        console.log('[Opsentinel Trace] Simulation: System information loaded.');
    } catch (error) {
        console.error('Failed to load simulated info:', error);
    }
}


/* --- Chart.js Configuration --- */
const maxDataPoints = 20;
const cpuData = Array(maxDataPoints).fill(0);
const memoryData = Array(maxDataPoints).fill(0);
const diskData = Array(maxDataPoints).fill(0);
const chartLabels = Array(maxDataPoints).fill('');

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { 
        duration: 2000, 
        easing: 'easeOutQuart' 
    },
    scales: {
        y: { 
            min: 0, max: 100, 
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { font: { size: 10, family: 'Inter' }, color: '#64748b', callback: v => v + '%' } 
        },
        x: { 
            display: true,
            ticks: { font: { size: 9, family: 'Inter' }, color: '#64748b', maxRotation: 45, minRotation: 45 },
            grid: { color: 'rgba(255, 255, 255, 0.03)' }
        }
    },
    plugins: { 
        legend: { 
            display: true,
            position: 'top',
            align: 'end',
            labels: {
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { size: 10, family: 'Outfit', weight: '600' },
                color: '#94a3b8'
            }
        },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Outfit' },
            bodyFont: { family: 'Inter' },
            padding: 10,
            cornerRadius: 8,
            displayColors: false
        }
    }
};

function createChart(ctxId, label, color, dataArray) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    
    // Create a high-fidelity linear gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, color + '44'); // Top (semi-transparent)
    gradient.addColorStop(1, color + '00'); // Bottom (invisible)

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: label,
                data: dataArray,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4, // Smooth curves
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: color,
                fill: true
            }]
        },
        options: chartOptions
    });
}

let charts = {};
const chartDataMap = {};

    charts.cpu    = createChart('cpuChart',    'CPU Usage',    '#3b82f6', cpuData);
    charts.memory = createChart('memoryChart', 'Memory Usage', '#f97316', memoryData); 
    charts.disk   = createChart('diskChart',   'Disk Usage',   '#22c55e', diskData); 

    chartDataMap.cpu    = cpuData;
    chartDataMap.memory = memoryData;
    chartDataMap.disk   = diskData;

    // Demo Mode: Force show dashboard immediately
    if (isDemo) {
        console.log('[DEMO] Static mode detected. Showing dashboard immediately.');
        const landing = document.getElementById('landing-section');
        const dashboard = document.getElementById('dashboard-section');
        if (landing) landing.style.display = 'none';
        if (dashboard) {
            dashboard.style.display = 'block';
            dashboard.classList.add('visible');
        }
    }

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Track all sections and cards
    document.querySelectorAll('.hero-section, .features-section, .how-it-works, .card, .content-header').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

function updateChartLabels() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chartLabels.push(time);
    if (chartLabels.length > maxDataPoints) chartLabels.shift();
}

function updateChart(type, value) {
    if (!charts[type]) return;
    const targetData = chartDataMap[type];
    if (targetData) {
        targetData.push(value);
        if (targetData.length > maxDataPoints) targetData.shift();
        charts[type].update();
    }
}


/* --- System Logs & Alerts --- */
let lastLogData = { cpu: null, memory: null, disk: null };

function getHighUsageItems(data) {
    const items = [];
    if (data.cpu    > 80) items.push('CPU');
    if (data.memory > 80) items.push('Memory');
    if (data.disk   > 80) items.push('Disk');
    return items;
}

function addLog(message, type = 'info') {
    const logsContainer = document.getElementById('system-logs');
    if (!logsContainer) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    logsContainer.prepend(entry);
    if (logsContainer.children.length > 50) logsContainer.removeChild(logsContainer.lastChild);
}

function evaluateLogs(data) {
    const highUsage = getHighUsageItems(data);

    if (highUsage.length > 0) {
        const message = `High usage detected: ${highUsage.join(', ')}`;
        addLog(message, 'critical');
        // STANDALONE DEMO: REMOVED fetch('/alert')
    } else {
        if (data.memory < 60 && lastLogData.memory !== null && Math.abs(data.memory - lastLogData.memory) <= 5) {
            addLog("Memory load stabilized", "info");
        } else if (lastLogData.cpu !== null && Math.abs(data.cpu - lastLogData.cpu) > 10) {
            addLog("CPU load spike handled", "info");
        }
    }
    lastLogData = { ...data };
}

function updateAlertBanner(data) {
    const banner = document.getElementById('high-usage-alert');
    if (!banner) return;
    const items = getHighUsageItems(data);
    if (items.length > 0) {
        banner.textContent = `CRITICAL: ${items.join('/')} OVERLOAD DETECTED`;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}


/* --- Server Management --- */
let managedServers = [];

    const addBtn = document.getElementById('add-server-btn');
    const input = document.getElementById('server-input');
    const list = document.getElementById('server-list');

    if (addBtn && input && list) {
        const handleAdd = () => {
            const name = input.value.trim();
            if (name && !managedServers.find(s => s.name === name)) {
                const li = document.createElement('li');
                li.className = 'node-item';
                
                li.innerHTML = `
                    <div class="node-info">
                        <div class="status-dot"></div>
                        <span>${name}</span>
                    </div>
                    <div class="node-metrics">
                        <span class="cpu-m">CPU: --%</span>
                        <span class="mem-m">RAM: --%</span>
                        <span class="dsk-m">DSK: --%</span>
                    </div>
                `;
                
                list.appendChild(li);
                
                const serverObj = {
                    name,
                    cpuEl: li.querySelector('.cpu-m'),
                    memEl: li.querySelector('.mem-m'),
                    dskEl: li.querySelector('.dsk-m')
                };
                
                managedServers.push(serverObj);
                input.value = '';
                addLog(`Node attached: ${name}`, 'info');
            }
        };

        addBtn.addEventListener('click', handleAdd);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleAdd(); });
    }

    // --- Immediate Render ---
    // Ensure dashboard components are visible before first fetch
    const dashboard = document.getElementById('dashboard-section') || document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'block';
        dashboard.classList.add('visible');
    }

    // --- Initial Flow ---
    // Fetch static system info once
    fetchSystemInfo();

    // Initial fetch/generate
    updateMetrics();

    // Standardized demo refresh rate: 2.5 seconds (2500ms)
    const rate = 2500; 
    
    // Primary metrics loop
    setInterval(updateMetrics, rate);

    // Managed nodes loop
    setInterval(() => {
        managedServers.forEach(s => {
            if (!s.cpuEl || !s.memEl || !s.dskEl) return;
            const cpu = Math.floor(Math.random() * 101);
            const mem = Math.floor(Math.random() * 101);
            const dsk = Math.floor(Math.random() * 101);

            s.cpuEl.textContent = `CPU: ${cpu}%`;
            s.memEl.textContent = `RAM: ${mem}%`;
            s.dskEl.textContent = `DSK: ${dsk}%`;
            
            s.cpuEl.style.color = getColor(cpu);
            s.memEl.style.color = getColor(mem);
            s.dskEl.style.color = getColor(dsk);
        });
    }, rate);
});
