/* --- Metrics Configuration --- */
const metricCache = {
    cpu: { text: null, bar: null, last: null },
    memory: { text: null, bar: null, last: null },
    disk: { text: null, bar: null, last: null }
};

function getColor(value) {
    if (value < 50) return '#4ade80'; // accent-green
    if (value <= 80) return '#fbbf24'; // accent-amber
    return '#ef4444'; // accent-red
}

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
    cache.last = value;

    cache.text.textContent = `${value}%`;
    cache.bar.style.width = `${value}%`;
    
    const color = getColor(value);
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

async function updateMetrics() {
    try {
        const response = await fetch('/metrics');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const res = await response.json();
        const data = res.data; 
        
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
    } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setOfflineUI();
    }
}

// Initial fetch
updateMetrics();

// Optimization: Reduce update frequency on mobile (from 2s to 4s)
const isMobile = window.innerWidth < 768;
const refreshRate = isMobile ? 4000 : 2000;
setInterval(updateMetrics, refreshRate);


/* --- Chart.js Configuration --- */
const maxDataPoints = 20;
const cpuData = Array(maxDataPoints).fill(0);
const memoryData = Array(maxDataPoints).fill(0);
const diskData = Array(maxDataPoints).fill(0);
const chartLabels = Array(maxDataPoints).fill('');

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'linear' },
    scales: {
        y: { 
            min: 0, max: 100, 
            grid: { color: '#1e2330' },
            ticks: { font: { size: 10 }, color: '#475569', callback: v => v + '%' } 
        },
        x: { 
            display: true,
            ticks: { font: { size: 9 }, color: '#475569', maxRotation: 45, minRotation: 45 },
            grid: { color: '#1e2330' }
        }
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
};

function createChart(ctxId, color, dataArray) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return null;
    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                data: dataArray,
                borderColor: color,
                backgroundColor: color + '15',
                borderWidth: 2,
                tension: 0.5,
                pointRadius: 0,
                fill: true
            }]
        },
        options: chartOptions
    });
}

let charts = {};
const chartDataMap = {};

document.addEventListener('DOMContentLoaded', () => {
    charts.cpu    = createChart('cpuChart',    '#4ade80', cpuData);
    charts.memory = createChart('memoryChart', '#c084fc', memoryData); 
    charts.disk   = createChart('diskChart',   '#fbbf24', diskData); 

    chartDataMap.cpu    = cpuData;
    chartDataMap.memory = memoryData;
    chartDataMap.disk   = diskData;
});

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
        fetch('/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        }).catch(err => console.error("Error pushing alert:", err));
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

document.addEventListener('DOMContentLoaded', () => {
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
});

setInterval(() => {
    managedServers.forEach(s => {
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
}, refreshRate); // Sync with dynamic refresh rate
