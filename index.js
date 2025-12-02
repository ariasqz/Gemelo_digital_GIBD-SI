// ---------------------------------------
// Variables globales
// ---------------------------------------
let scene, camera, renderer, sensor, controls;
let sensorTemperature = 25.0;
let ambientTemperature = 25.0;
let responseTime = 5.0;
let noiseLevel = 0.05;
let driftOffset = 0.0;
let calibrationOffset = 0.0;
let startTime = Date.now();
let isSimulating = true;

let sensorBody, probe, wires = [], circuitBoard, housing, heatIndicator;
let temperatureHistory = [];

let isMeasuring = false;
let measurementInterval = null;
let measurementData = [];
let temperatureChart = null;
let measurementStartTime = Date.now();

let kalmanFilter = { x: 10.0, P: 10000.0001, q: 0.0001, r: 0.01, K: 0, isInitialized: false };
let kalmanData = [];
let trueValues = [];
let measurements = [];
let estimates = [];

// ---------------------------------------
// Inicialización
// ---------------------------------------
function init() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(5, 3, 5);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;

        // Marcar el canvas del renderer con la clase específica
        renderer.domElement.classList.add('three-canvas');

        const container = document.getElementById('container');
        if (!container) throw new Error("No se encontró el contenedor #container");
        container.appendChild(renderer.domElement);

        // luces y modelo
        setupLights();
        try { createSensorModel(); } catch (errModel) { console.error("Error creando el modelo 3D:", errModel); alert("Error creando modelo 3D. Mira la consola."); }

        // controles UI y chart
        setupControls();
        initializeChart();

        // animación y actualización
        animate();
        setInterval(updateSensor, 100);

        console.log("Inicialización completa (cables mejorados + rotación x4).");
    } catch (err) {
        console.error("Error en init():", err);
        alert("Error grave al iniciar la escena. Mira la consola (F12).");
    }
}

// ---------------------------------------
// Luces
// ---------------------------------------
function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 10, 5);
    dir.castShadow = true;
    scene.add(dir);

    const p = new THREE.PointLight(0x60a5fa, 0.8, 10);
    p.position.set(0, 3, 2);
    scene.add(p);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-5, 5, -5);
    scene.add(fill);
}

// ---------------------------------------
// Modelo: cuerpo más delgado, cables mejorados (TubeGeometry)
// ---------------------------------------
function createSensorModel() {
    sensor = new THREE.Group();

    // cuerpo delgado
    const bodyG = new THREE.CylinderGeometry(0.18, 0.18, 2, 16);
    const bodyM = new THREE.MeshPhysicalMaterial({ color: 0xd3d3d3, metalness: 0.8, roughness: 0.2, clearcoat: 0.1 });
    sensorBody = new THREE.Mesh(bodyG, bodyM);
    sensorBody.position.y = 0;
    sensorBody.castShadow = true;
    sensorBody.receiveShadow = true;
    sensor.add(sensorBody);

    // sonda
    const probeG = new THREE.CylinderGeometry(0.1, 0.05, 1, 8);
    const probeM = new THREE.MeshPhysicalMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1, emissive: 0x221100, emissiveIntensity: 0.1 });
    probe = new THREE.Mesh(probeG, probeM);
    probe.position.y = -1.5;
    probe.castShadow = true;
    sensor.add(probe);

    // housing (superior intacta)
    const housingG = new THREE.CylinderGeometry(0.4, 0.3, 0.5, 16);
    const housingM = new THREE.MeshPhysicalMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.3 });
    housing = new THREE.Mesh(housingG, housingM);
    housing.position.y = 1.25;
    housing.castShadow = true;
    sensor.add(housing);

    // placa superior
    const boardG = new THREE.BoxGeometry(0.6, 0.1, 0.4);
    const boardM = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
    circuitBoard = new THREE.Mesh(boardG, boardM);
    circuitBoard.position.y = 1.55;
    circuitBoard.castShadow = true;
    sensor.add(circuitBoard);

    // componentes
    for (let i = 0; i < 6; i++) {
        const cG = new THREE.BoxGeometry(0.05, 0.03, 0.05);
        const cM = new THREE.MeshLambertMaterial({ color: Math.random() > 0.5 ? 0x1a1a1a : 0x8b4513 });
        const comp = new THREE.Mesh(cG, cM);
        comp.position.set((Math.random() - 0.5) * 0.4, 1.6, (Math.random() - 0.5) * 0.3);
        sensor.add(comp);
    }

    // --- cables mejorados: curvas que salen desde la placa ---
    // definimos 3 puntos de inicio sobre la placa (ligera variación en X/Z)
    const startY = circuitBoard.position.y + 0.05; // justo encima de la placa
    const starts = [
        new THREE.Vector3(0.12, startY, 0.08),
        new THREE.Vector3(0.00, startY, -0.12),
        new THREE.Vector3(-0.12, startY, 0.08)
    ];

    const colors = [0xff0000, 0x0000ff, 0x00cc44];
    // crear curvas y TubeGeometry para cada cable
    for (let i = 0; i < 3; i++) {
        const s = starts[i];
        // punto intermedio que crea la curvatura: hacia arriba y afuera
        const mid = new THREE.Vector3(s.x * 1.2, s.y + 0.6, s.z * 2.0 + (i === 1 ? -0.15 : 0.15));
        // punto final (con ligera caída) fuera del modelo
        const end = new THREE.Vector3(s.x * 1.6, s.y + 0.9, s.z * 2.7 + (i === 1 ? -0.35 : 0.35));
        const pts = [s, mid, end];
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.02, 8, false);
        const mat = new THREE.MeshStandardMaterial({ color: colors[i], metalness: 0.3, roughness: 0.6, emissive: 0x000000 });
        const cable = new THREE.Mesh(tubeGeo, mat);
        cable.castShadow = true;
        cable.receiveShadow = true;
        // añadir al grupo sensor para que parezcan salir del mismo
        sensor.add(cable);
        wires.push(cable);

        // pequeña malla esférica en el punto de conexión para soldadura visual
        const capGeom = new THREE.SphereGeometry(0.025, 12, 12);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 });
        const cap = new THREE.Mesh(capGeom, capMat);
        cap.position.copy(s);
        sensor.add(cap);
    }

    // indicador calor
    const heatG = new THREE.SphereGeometry(0.05, 16, 16);
    const heatM = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
    heatIndicator = new THREE.Mesh(heatG, heatM);
    heatIndicator.position.set(0.4, 0, 0);
    sensor.add(heatIndicator);

    // base
    const baseG = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const baseM = new THREE.MeshLambertMaterial({ color: 0x34495e });
    const base = new THREE.Mesh(baseG, baseM);
    base.position.y = -2.5;
    sensor.add(base);

    scene.add(sensor);

    // suelo
    const floorG = new THREE.PlaneGeometry(20, 20);
    const floorM = new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 });
    const floor = new THREE.Mesh(floorG, floorM);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    console.log("Sensor 3D (cuerpo delgado + cables conectados) creado OK");
}

// ---------------------------------------
// Controls (UI + OrbitControls)
// ---------------------------------------
function setupControls() {
    const tempSlider = document.getElementById('temp-slider');
    const tempInput = document.getElementById('temp-input');
    tempSlider.addEventListener('input', e => { ambientTemperature = parseFloat(e.target.value); tempInput.value = ambientTemperature; updateAmbientDisplay(); });
    tempInput.addEventListener('input', e => { ambientTemperature = parseFloat(e.target.value); tempSlider.value = ambientTemperature; updateAmbientDisplay(); });

    const responseSlider = document.getElementById('response-slider');
    const responseInput = document.getElementById('response-input');
    responseSlider.addEventListener('input', e => { responseTime = parseFloat(e.target.value); responseInput.value = responseTime; updateResponseTimeDisplay(); });
    responseInput.addEventListener('input', e => { responseTime = parseFloat(e.target.value); responseSlider.value = responseTime; updateResponseTimeDisplay(); });

    const noiseSlider = document.getElementById('noise-slider');
    const noiseInput = document.getElementById('noise-input');
    noiseSlider.addEventListener('input', e => { noiseLevel = parseFloat(e.target.value); noiseInput.value = noiseLevel; });
    noiseInput.addEventListener('input', e => { noiseLevel = parseFloat(e.target.value); noiseSlider.value = noiseLevel; });

    try {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = true;
        controls.minDistance = 2;
        controls.maxDistance = 20;
    } catch (ctrlErr) {
        console.warn("OrbitControls no disponible o fallo al inicializar:", ctrlErr);
    }

    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const toggleBtn = document.getElementById('toggle-panels');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('panels-hidden');
            const hidden = document.body.classList.contains('panels-hidden');
            toggleBtn.textContent = hidden ? '🔍 Mostrar UI' : '👁️ Ver modelo';
            try { if (controls && controls.target) controls.target.set(0, 0, 0); } catch (e) { }
        });
    }
}

// ---------------------------------------
// Chart
// ---------------------------------------
function initializeChart() {
    try {
        const ctx = document.getElementById('temperatureChart').getContext('2d');
        temperatureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], datasets: [
                    { label: 'Temperatura Real', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, fill: false, tension: 0.3 },
                    { label: 'Mediciones', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, fill: false, tension: 0.3 },
                    { label: 'Estimaciones Kalman', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 2, fill: false, tension: 0.3 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'white' } } },
                scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } }
            }
        });
    } catch (chartErr) {
        console.warn("Error inicializando Chart.js:", chartErr);
    }
}

// ---------------------------------------
// Simulación del sensor
// ---------------------------------------
function updateSensor() {
    if (!isSimulating) return;
    const dt = 0.1;
    const alpha = dt / (responseTime + dt);
    sensorTemperature += alpha * (ambientTemperature - sensorTemperature);
    const timeHours = (Date.now() - startTime) / (1000 * 60 * 60);
    driftOffset = 0.001 * timeHours;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    const measuredTemp = sensorTemperature + driftOffset + noise + calibrationOffset;

    updateSensorVisualization(measuredTemp);
    updateDataDisplays(measuredTemp);

    temperatureHistory.push({ time: Date.now(), measured: measuredTemp, ambient: ambientTemperature });
    if (temperatureHistory.length > 2000) temperatureHistory.shift();
}

function updateSensorVisualization(temperature) {
    const normalizedTemp = Math.max(-40, Math.min(150, temperature));
    const tempRatio = (normalizedTemp + 40) / 190;
    const hue = (1 - tempRatio) * 240;
    if (heatIndicator && heatIndicator.material) {
        try { heatIndicator.material.color.setHSL(hue / 360, 1, 0.5); } catch (e) { }
        heatIndicator.material.opacity = 0.5 + 0.3 * Math.sin(Date.now() * 0.005);
    }
    // rotación del sensor (x4 la velocidad ante1   rior)
    if (sensor) sensor.rotation.y += 0.02;
    if (probe && probe.material) {
        probe.material.emissiveIntensity = (temperature > 50) ? Math.min(0.5, (temperature - 50) / 100) : 0.1;
    }
}

function updateDataDisplays(measuredTemp) {
    document.getElementById('current-temp').textContent = measuredTemp.toFixed(2) + '°C';
    document.getElementById('temp-display').textContent = measuredTemp.toFixed(1) + '°C';
    document.getElementById('ambient-temp').textContent = ambientTemperature.toFixed(1) + '°C';
    document.getElementById('error').textContent = '±' + Math.abs(measuredTemp - ambientTemperature).toFixed(2) + '°C';
    document.getElementById('drift').textContent = driftOffset.toFixed(3) + '°C';
    document.getElementById('measurement-count').textContent = measurementData.length;
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600), minutes = Math.floor((uptime % 3600) / 60), seconds = uptime % 60;
    document.getElementById('uptime').textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ---------------------------------------
// Mediciones, Kalman, tabla y utilidades (idéntico a v5)
// ---------------------------------------
function startMeasurement() {
    if (isMeasuring) return;
    isMeasuring = true;
    measurementStartTime = Date.now();
    measurementData = [];
    document.getElementById('measurement-status').style.display = 'block';
    document.getElementById('chart-container').style.display = 'block';
    document.getElementById('chart-open-btn').style.display = 'none';
    document.getElementById('measurement-button').style.display = 'none';
    document.getElementById('stop-measurement-button').style.display = 'inline-block';
    if (temperatureChart) {
        temperatureChart.data.labels = [];
        temperatureChart.data.datasets[0].data = [];
        temperatureChart.data.datasets[1].data = [];
        temperatureChart.update();
    }
    takeMeasurement();
    measurementInterval = setInterval(takeMeasurement, 5000);
}

function stopMeasurement() {
    if (!isMeasuring) return;
    isMeasuring = false;
    if (measurementInterval) { clearInterval(measurementInterval); measurementInterval = null; }
    document.getElementById('measurement-status').style.display = 'none';
    document.getElementById('measurement-button').style.display = 'inline-block';
    document.getElementById('stop-measurement-button').style.display = 'none';
    if (measurementData.length > 0) showMeasurementSummary();
}

function takeMeasurement() {
    const currentTime = (Date.now() - measurementStartTime) / 1000;
    const timeHours = (Date.now() - startTime) / (1000 * 60 * 60);
    const currentDrift = 0.001 * timeHours;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    const measuredTemp = sensorTemperature + currentDrift + noise + calibrationOffset;
    const measurement = { time: currentTime, realTemp: ambientTemperature, measuredTemp: measuredTemp, error: Math.abs(measuredTemp - ambientTemperature), timestamp: new Date() };
    measurementData.push(measurement);
    if (temperatureChart) {
        temperatureChart.data.labels.push(Number(currentTime.toFixed(0)));
        temperatureChart.data.datasets[0].data.push(Number(measurement.realTemp.toFixed(2)));
        temperatureChart.data.datasets[1].data.push(Number(measurement.measuredTemp.toFixed(2)));
        temperatureChart.update('none');
        if (temperatureChart.data.labels.length > 50) {
            temperatureChart.data.labels.shift();
            temperatureChart.data.datasets[0].data.shift();
            temperatureChart.data.datasets[1].data.shift();
        }
    }
}

function initKalmanFilter() { kalmanFilter = { x: 10.0, P: 10000.0001, q: 0.0001, r: 0.01, K: 0, isInitialized: false }; kalmanData = []; trueValues = []; measurements = []; estimates = []; }
function kalmanIteration(measurement, trueValue, iterationNumber) {
    const result = {}; result.z = measurement; result.trueValue = trueValue; result.n = iterationNumber;
    kalmanFilter.K = kalmanFilter.P / (kalmanFilter.P + kalmanFilter.r); result.K = kalmanFilter.K;
    kalmanFilter.x = kalmanFilter.x + kalmanFilter.K * (measurement - kalmanFilter.x); result.x_updated = kalmanFilter.x;
    kalmanFilter.P = (1 - kalmanFilter.K) * kalmanFilter.P; result.P_updated = kalmanFilter.P;
    result.x_predicted = kalmanFilter.x; const predictedP = kalmanFilter.P + kalmanFilter.q; result.P_predicted = predictedP; kalmanFilter.P = predictedP;
    kalmanData.push(result); trueValues.push(trueValue); measurements.push(measurement); estimates.push(kalmanFilter.x);
    return result;
}

function startKalmanFilter() { if (isMeasuring) return; initKalmanFilter(); isMeasuring = true; measurementStartTime = Date.now(); measurementData = []; document.getElementById('kalman-status').style.display = 'block'; document.getElementById('chart-container').style.display = 'block'; document.getElementById('chart-open-btn').style.display = 'none'; document.getElementById('kalman-button').style.display = 'none'; document.getElementById('stop-kalman-button').style.display = 'inline-block'; if (temperatureChart) { temperatureChart.data.labels = []; temperatureChart.data.datasets[0].data = []; temperatureChart.data.datasets[1].data = []; temperatureChart.data.datasets[2].data = []; temperatureChart.update(); } takeKalmanMeasurement(); measurementInterval = setInterval(takeKalmanMeasurement, 5000); }
function stopKalmanFilter() { if (!isMeasuring) return; isMeasuring = false; if (measurementInterval) { clearInterval(measurementInterval); measurementInterval = null; } document.getElementById('kalman-status').style.display = 'none'; document.getElementById('kalman-button').style.display = 'inline-block'; document.getElementById('stop-kalman-button').style.display = 'none'; }
function takeKalmanMeasurement() { const currentTime = (Date.now() - measurementStartTime) / 1000; const timeHours = (Date.now() - startTime) / (1000 * 60 * 60); const currentDrift = 0.001 * timeHours; const noise = (Math.random() - 0.5) * 2 * noiseLevel; const measuredTemp = sensorTemperature + currentDrift + noise + calibrationOffset; const trueTemp = ambientTemperature; const iterationNumber = kalmanData.length + 1; const kalmanResult = kalmanIteration(measuredTemp, trueTemp, iterationNumber); const measurement = { time: currentTime, realTemp: trueTemp, measuredTemp: measuredTemp, kalmanEstimate: kalmanResult.x_updated, error: Math.abs(measuredTemp - trueTemp), kalmanError: Math.abs(kalmanResult.x_updated - trueTemp), timestamp: new Date(), kalmanData: kalmanResult }; measurementData.push(measurement); if (temperatureChart) { temperatureChart.data.labels.push(iterationNumber); temperatureChart.data.datasets[0].data.push(Number(trueTemp.toFixed(3))); temperatureChart.data.datasets[1].data.push(Number(measuredTemp.toFixed(3))); temperatureChart.data.datasets[2].data.push(Number(kalmanResult.x_updated.toFixed(3))); temperatureChart.update('none'); if (temperatureChart.data.labels.length > 50) { temperatureChart.data.labels.shift(); temperatureChart.data.datasets[0].data.shift(); temperatureChart.data.datasets[1].data.shift(); temperatureChart.data.datasets[2].data.shift(); } } }

function showKalmanTable() { const modal = document.getElementById('kalman-table-container'); if (!modal) return; populateKalmanTable(); modal.style.display = 'block'; }
function closeKalmanTable() { const modal = document.getElementById('kalman-table-container'); if (!modal) return; modal.style.display = 'none'; }
function populateKalmanTable() { const body = document.getElementById('kalman-table-body'); body.innerHTML = ''; if (!kalmanData || kalmanData.length === 0) { const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="7" style="color:#aaa;">No hay datos de Kalman todavía.</td>`; body.appendChild(tr); return; } for (let i = 0; i < kalmanData.length; i++) { const row = kalmanData[i]; const z = (measurements[i] !== undefined) ? Number(measurements[i]).toFixed(6) : (row.z !== undefined ? Number(row.z).toFixed(6) : 'N/A'); const K = row.K !== undefined ? Number(row.K).toFixed(6) : 'N/A'; const x_u = row.x_updated !== undefined ? Number(row.x_updated).toFixed(6) : 'N/A'; const P_u = row.P_updated !== undefined ? Number(row.P_updated).toFixed(6) : 'N/A'; const x_p = row.x_predicted !== undefined ? Number(row.x_predicted).toFixed(6) : 'N/A'; const P_p = row.P_predicted !== undefined ? Number(row.P_predicted).toFixed(6) : 'N/A'; const tr = document.createElement('tr'); tr.innerHTML = `<td>${i + 1}</td><td>${z}</td><td>${K}</td><td>${x_u}</td><td>${P_u}</td><td>${x_p}</td><td>${P_p}</td>`; body.appendChild(tr); } body.scrollTop = body.scrollHeight; }

function showMeasurementSummary() { if (measurementData.length === 0) return; const errors = measurementData.map(m => m.error); const avgError = errors.reduce((a, b) => a + b, 0) / errors.length; alert(`Total: ${measurementData.length}\nError medio: ${avgError.toFixed(3)}°C`); }
function exportMeasurements() { if (measurementData.length === 0) { alert('No hay mediciones'); return; } let csv = ''; if (kalmanData && kalmanData.length > 0) { csv = 'Iteracion,Tiempo(s),Temp_Real,Medicion_Z,Gain_K,Estimacion_X,Incertidumbre_P,Pred_X,Pred_P,Error,KalmanError\n'; measurementData.forEach((m, i) => { const k = m.kalmanData || {}; csv += `${i + 1},${m.time.toFixed(1)},${m.realTemp.toFixed(4)},${m.measuredTemp.toFixed(4)},${k.K ? Number(k.K).toFixed(6) : 'N/A'},${k.x_updated ? Number(k.x_updated).toFixed(6) : 'N/A'},${k.P_updated ? Number(k.P_updated).toFixed(6) : 'N/A'},${k.x_predicted ? Number(k.x_predicted).toFixed(6) : 'N/A'},${k.P_predicted ? Number(k.P_predicted).toFixed(6) : 'N/A'},${m.error.toFixed(4)},${m.kalmanError ? m.kalmanError.toFixed(4) : 'N/A'}\n`; }); } else { csv = 'Tiempo(s),Temp_Real,Temp_Medida,Error,Timestamp\n'; measurementData.forEach(m => { csv += `${m.time.toFixed(1)},${m.realTemp.toFixed(3)},${m.measuredTemp.toFixed(3)},${m.error.toFixed(3)},${m.timestamp.toISOString()}\n`; }); } const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mediciones_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert('Datos exportados'); }
function clearChart() { measurementData = []; kalmanData = []; measurements = []; estimates = []; if (temperatureChart) { temperatureChart.data.labels = []; temperatureChart.data.datasets.forEach(ds => ds.data = []); temperatureChart.update(); } }

function toggleSimulation() { isSimulating = !isSimulating; const btn = document.getElementById('sim-button'); if (isSimulating) { btn.textContent = '⏸️ Pausar'; document.getElementById('status').textContent = 'Online'; } else { btn.textContent = '▶️ Iniciar'; document.getElementById('status').textContent = 'Pausado'; } }
function addHeat() { ambientTemperature = Math.min(150, ambientTemperature + 10); document.getElementById('temp-slider').value = ambientTemperature; document.getElementById('temp-input').value = ambientTemperature; updateAmbientDisplay(); }
function addCold() { ambientTemperature = Math.max(-40, ambientTemperature - 10); document.getElementById('temp-slider').value = ambientTemperature; document.getElementById('temp-input').value = ambientTemperature; updateAmbientDisplay(); }
function calibrateSensor() { calibrationOffset = ambientTemperature - sensorTemperature; alert(`Calibrado. Offset ${calibrationOffset.toFixed(3)}°C`); }
function resetSensor() { if (isMeasuring) { stopMeasurement(); stopKalmanFilter(); } sensorTemperature = 25; ambientTemperature = 25; calibrationOffset = 0; driftOffset = 0; startTime = Date.now(); measurementData = []; temperatureHistory = []; initKalmanFilter(); document.getElementById('temp-slider').value = 25; document.getElementById('temp-input').value = 25; document.getElementById('response-slider').value = 5; document.getElementById('response-input').value = 5; document.getElementById('noise-slider').value = 0.05; document.getElementById('noise-input').value = 0.05; clearChart(); document.getElementById('chart-container').style.display = 'none'; document.getElementById('chart-open-btn').style.display = 'none'; document.getElementById('measurement-status').style.display = 'none'; document.getElementById('kalman-status').style.display = 'none'; document.getElementById('measurement-button').style.display = 'inline-block'; document.getElementById('stop-measurement-button').style.display = 'none'; document.getElementById('kalman-button').style.display = 'inline-block'; document.getElementById('stop-kalman-button').style.display = 'none'; closeKalmanTable(); console.log('Sensor reiniciado'); }

// Toggle chart visibility (no afecta mediciones)
function toggleChartVisibility(forceShow) {
    const container = document.getElementById('chart-container');
    const btn = document.getElementById('chart-toggle-btn');
    const openBtn = document.getElementById('chart-open-btn');
    if (!container || !btn) return;
    const isHidden = container.style.display === 'none' || getComputedStyle(container).display === 'none';
    const show = (typeof forceShow !== 'undefined') ? forceShow : isHidden;
    if (show) {
        container.style.display = 'block';
        btn.textContent = '📈 Ocultar';
        if (openBtn) openBtn.style.display = 'none';
    } else {
        container.style.display = 'none';
        btn.textContent = '📊 Mostrar';
        if (openBtn) openBtn.style.display = 'block';
    }
}

// Animación
function animate() {
    requestAnimationFrame(animate);
    try { if (controls) controls.update(); } catch (e) { }
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// iniciar
window.addEventListener('load', () => { setTimeout(init, 100); });

// helpers
function updateAmbientDisplay() { document.getElementById('ambient-temp').textContent = ambientTemperature.toFixed(1) + '°C'; }
function updateResponseTimeDisplay() { document.getElementById('response-time').textContent = responseTime.toFixed(1) + 's'; }
