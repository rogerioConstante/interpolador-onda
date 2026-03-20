// Configurações Globais
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioData1 = null;
let audioData2 = null;
let resultAudio = null;
const sampleRate = 44100;

const players = {
    '1': { source: null },
    '2': { source: null },
    'Result': { source: null }
};

document.addEventListener('DOMContentLoaded', function() {
    // 1. Listeners de Arquivos
    document.getElementById('audio1').addEventListener('change', (e) => loadAudio(e, '1'));
    document.getElementById('audio2').addEventListener('change', (e) => loadAudio(e, '2'));

    // 2. Botão de Transformação
    document.getElementById('transformBtn').addEventListener('click', processarInterpolacao);

    // 3. Listener do Seletor (Select)
    const selectType = document.getElementById('interpolationType');
    if (selectType) {
        selectType.addEventListener('change', updateInterfaceConfig);
    }

    // 4. Inicialização de Visibilidade e Controles
    updateInterfaceConfig();
    setupPanelControls('1');
    setupPanelControls('2');
    setupPanelControls('Result');

    // Listeners para atualizar os números na tela quando arrasta o slider
    setupSliderLabels();
});

// --- INTERFACE E VISIBILIDADE ---

function updateInterfaceConfig() {
    const select = document.getElementById('interpolationType');
    if (!select) return;

    const tipo = select.value;

    // Atualiza o label central no topo do conteúdo
    const labelTopo = document.getElementById('Interpolação-label');
    if (labelTopo) labelTopo.innerText = select.options[select.selectedIndex].text;

    // IDs dos contêineres conforme seu HTML
    const grainCont = document.getElementById('grainDurationContainer');
    const crossCont = document.getElementById('crossfadeContainer');
    const durRandCont = document.getElementById('durationRandomnessContainer');
    const randSliderCont = document.getElementById('randomnessSliderContainer');

    // Lógica de visibilidade rigorosa
    if (tipo === 'grain') {
        if(grainCont) grainCont.classList.remove('hidden');
        if(crossCont) crossCont.style.display = 'block';
        if(durRandCont) durRandCont.style.display = 'block';
        if(randSliderCont) randSliderCont.style.display = 'none';
    } else if (tipo === 'random') {
        if(grainCont) grainCont.classList.add('hidden');
        if(crossCont) crossCont.style.display = 'none';
        if(durRandCont) durRandCont.style.display = 'none';
        if(randSliderCont) randSliderCont.style.display = 'block';
    } else {
        // Modo Regular (equal)
        if(grainCont) grainCont.classList.add('hidden');
        if(crossCont) crossCont.style.display = 'none';
        if(durRandCont) durRandCont.style.display = 'none';
        if(randSliderCont) randSliderCont.style.display = 'none';
    }
}

function setupSliderLabels() {
    const sliders = ['progress', 'randomness', 'crossfade', 'durationRandomness'];
    sliders.forEach(id => {
        const s = document.getElementById(id + 'Slider');
        const v = document.getElementById(id + 'Value');
        if (s && v) {
            s.addEventListener('input', () => { v.innerText = s.value; });
        }
    });
}

// --- CARREGAMENTO ---

async function loadAudio(event, panel) {
    const file = event.target.files[0];
    if (!file) return;

    // Atualiza o nome do arquivo
    const nameDiv = document.getElementById(`audio${panel}-name`);
    if (nameDiv) nameDiv.innerText = file.name;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const data = audioBuffer.getChannelData(0);

        if (panel === '1') audioData1 = new Float32Array(data);
        else audioData2 = new Float32Array(data);

        document.getElementById(`duration${panel}`).innerText = audioBuffer.duration.toFixed(2) + 's';
        drawWaveform(data, `waveform${panel}`);

        if (audioData1 && audioData2) {
            document.getElementById('transformBtn').disabled = false;
        }
        updateStatus(`Áudio ${panel} pronto.`);
    } catch (e) {
        updateStatus("Erro ao carregar áudio.");
    }
}

// --- PROCESSAMENTO ---

function processarInterpolacao() {
    if (!audioData1 || !audioData2) return;

    const tipo = document.getElementById('interpolationType').value;
    const mixFator = parseFloat(document.getElementById('progressSlider').value) / 100;

    updateStatus("Processando...", true);

    setTimeout(() => {
        const t0 = performance.now();

        if (tipo === 'grain') {
            resultAudio = interpolarGraos(audioData1, audioData2, mixFator);
        } else {
            const randomness = parseFloat(document.getElementById('randomnessSlider').value) / 100;
            const tamanhoFinal = Math.max(audioData1.length, audioData2.length);
            const jitterVal = (tipo === 'random') ? randomness : 0;

            const a1 = redimensionar(audioData1, tamanhoFinal, jitterVal);
            const a2 = redimensionar(audioData2, tamanhoFinal, jitterVal);

            resultAudio = new Float32Array(tamanhoFinal);
            for (let i = 0; i < tamanhoFinal; i++) {
                resultAudio[i] = (a1[i] * (1 - mixFator)) + (a2[i] * mixFator);
            }
        }

        drawWaveform(resultAudio, 'waveformResult');
        document.getElementById('durationResult').innerText = (resultAudio.length / sampleRate).toFixed(2) + 's';

        // Habilita botões de resultado conforme IDs do HTML
        ['playResult', 'stopResult', 'pauseResult', 'recordResult', 'normalizeResult'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = false;
        });

            updateStatus(`Pronto (${(performance.now() - t0).toFixed(0)}ms)`);
    }, 50);
}

// --- ALGORITMOS ---

function redimensionar(data, novoTamanho, jitter) {
    const output = new Float32Array(novoTamanho);
    const proporcao = (data.length - 1) / (novoTamanho - 1);
    for (let i = 0; i < novoTamanho; i++) {
        let idx = i * proporcao;
        if (jitter > 0) {
            idx += (Math.random() - 0.5) * (jitter * 500);
            idx = Math.max(0, Math.min(data.length - 1, idx));
        }
        const low = Math.floor(idx);
        const high = Math.ceil(idx);
        const w = idx - low;
        output[i] = (1 - w) * data[low] + (w * (data[high] || data[low]));
    }
    return output;
}

function interpolarGraos(data1, data2, fator) {
    // Usa o ID grainDurationInput do seu HTML
    const grainMs = parseFloat(document.getElementById('grainDurationInput').value) || 100;
    const grainSamples = Math.floor((grainMs / 1000) * sampleRate);
    const totalSamples = Math.max(data1.length, data2.length);
    const output = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i += grainSamples) {
        const source = Math.random() < fator ? data2 : data1;
        const start = i % source.length;
        for (let j = 0; j < grainSamples && (i + j) < totalSamples; j++) {
            output[i + j] = source[(start + j) % source.length];
            // Fade anti-click
            if (j < 150) output[i + j] *= (j / 150);
            if (j > grainSamples - 150) output[i + j] *= ((grainSamples - j) / 150);
        }
    }
    return output;
}

// --- AUDIO E CANVAS ---

function setupPanelControls(id) {
    const playBtn = document.getElementById(`play${id}`);
    const stopBtn = document.getElementById(`stop${id}`);

    if (playBtn) {
        playBtn.onclick = async () => {
            if (audioContext.state === 'suspended') await audioContext.resume();
            stopAudio(id);

            let data;
            if (id === '1') data = audioData1;
            else if (id === '2') data = audioData2;
            else data = resultAudio;

            if (!data) return;

            const buffer = audioContext.createBuffer(1, data.length, sampleRate);
            buffer.copyToChannel(data, 0);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            players[id].source = source;
        };
    }
    if (stopBtn) stopBtn.onclick = () => stopAudio(id);
}

function stopAudio(id) {
    if (players[id] && players[id].source) {
        try { players[id].source.stop(); } catch(e) {}
        players[id].source = null;
    }
}

function drawWaveform(data, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = canvasId.includes('Result') ? '#00ff88' : '#00aaff';
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0, max = -1.0;
        for (let j = 0; j < step; j++) {
            const d = data[i * step + j];
            if (d < min) min = d; if (d > max) max = d;
        }
        ctx.moveTo(i, (1 + min) * amp); ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
}

function updateStatus(msg, loading = false) {
    const status = document.getElementById('status');
    if (status) status.innerText = msg;
}
