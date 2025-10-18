let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioData1 = null;
let audioData2 = null;
let resultAudio = null;
let currentSource = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let currentInterpolationType = 'random';
let grainSize = 50; // ms
let crossfadePercentage = 0; // 0% a 100%
let durationRandomness = 0; // 0% a 100%

// Dados FFT de alta definição
let fftData1 = { frequencies: null, magnitudes: null, phases: null };
let fftData2 = { frequencies: null, magnitudes: null, phases: null };
let fftResult = { frequencies: null, magnitudes: null, phases: null };

const fftSize = 4096; // Alta definição
let sampleRate = 44100;


// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('audio1').addEventListener('change', (e) => loadAudio(e, 1));
    document.getElementById('audio2').addEventListener('change', (e) => loadAudio(e, 2));
    document.getElementById('transformBtn').addEventListener('click', () => applyTransformation());
    document.getElementById('play1').addEventListener('click', () => playAudio(audioData1));
    document.getElementById('play2').addEventListener('click', () => playAudio(audioData2));
    document.getElementById('playResult').addEventListener('click', () => playAudio(resultAudio));
    document.getElementById('recordResult').addEventListener('click', () => toggleRecording());
    document.getElementById('normalizeResult').addEventListener('click', () => normalizeAudio());
    document.getElementById('grainDurationContainer').classList.add('hidden');
    document.getElementById('randomnessSliderContainer').classList.remove('hidden');
    document.getElementById('crossfadeContainer').classList.add('hidden');
    document.getElementById('durationRandomnessContainer').classList.add('hidden');

    // Seletor de tipo de interpolação
    document.getElementById('interpolationType').addEventListener('change', function() {
        currentInterpolationType = this.value;
        let text;

        // Obter referências aos containers
        const randomnessContainer = document.getElementById('randomnessSliderContainer');
        const grainContainer = document.getElementById('grainDurationContainer');
        const crossfadeContainer = document.getElementById('crossfadeContainer');
        const durationRandomnessContainer = document.getElementById('durationRandomnessContainer');

        switch(this.value) {
            case "random":
                text = "Interpolação de ondas sonoras com distribuição aleatória";
                randomnessContainer.classList.remove('hidden');
                grainContainer.classList.add('hidden');
                crossfadeContainer.classList.add('hidden');
                durationRandomnessContainer.classList.add('hidden');
                break;
            case "equal":
                text = "Interpolação de ondas sonoras com distribuição regular";
                randomnessContainer.classList.add('hidden');
                grainContainer.classList.add('hidden');
                crossfadeContainer.classList.add('hidden');
                durationRandomnessContainer.classList.add('hidden');
                break;
            case "grain":
                text = "Interpolação de ondas sonoras com mistura de grãos";
                randomnessContainer.classList.remove('hidden');
                grainContainer.classList.remove('hidden');
                crossfadeContainer.classList.remove('hidden');
                durationRandomnessContainer.classList.remove('hidden');
                break;
        }
        document.getElementById('Interpolação-label').textContent = text;
    });

    // Controle de tamanho do grão
    document.getElementById('grainDurationInput').addEventListener('input', function() {
        grainSize = parseInt(this.value);
        // Garantir que o valor fique dentro dos limites
        if (grainSize < 10) grainSize = 10;
    });
    // Controle de crossfade
    document.getElementById('crossfadeSlider').addEventListener('input', function() {
        crossfadePercentage = parseInt(this.value);
        document.getElementById('crossfadeValue').textContent = this.value;
    });

    // Controle de aleatoriedade da duração
    document.getElementById('durationRandomnessSlider').addEventListener('input', function() {
        durationRandomness = parseInt(this.value);
        document.getElementById('durationRandomnessValue').textContent = this.value;
    });
    // Barra de aleatoriedade
    document.getElementById('interpolationType').addEventListener('change', (e) => {
        document.getElementById('randomnessSliderContainer').classList.toggle('hidden', e.target.value !== 'random' && e.target.value !== 'grain');
    });
    document.getElementById('randomnessSlider').addEventListener('input', function() {
        document.getElementById('randomnessValue').textContent = this.value;
    });
    // barra de interpolação
    document.getElementById('progressSlider').addEventListener('input', function() {
        document.getElementById('progressValue').textContent = this.value;
    });
    //document.getElementById('progressSlider').addEventListener('mouseup', () => applyTransformation());
});

function updateInfo() {
    if (audioData1) {
        document.getElementById('sampleRate').textContent = sampleRate.toLocaleString();
        document.getElementById('fftSize').textContent = fftSize.toLocaleString();
        document.getElementById('freqResolution').textContent = (sampleRate / fftSize).toFixed(2);
        document.getElementById('duration').textContent = (audioData1.length / sampleRate).toFixed(2);
    }
}

function applyTransformation() {
    console.log("Aplicando transformação...")
    if (!audioData1 || !audioData2) {
        updateStatus('Carregue os dois áudios, por favor!');
        console.log('Carregue os dois áudios, por favor!')
        return
    }

    const fator = document.getElementById('progressSlider').value;

    // Seleciona o tipo de interpolação baseado na escolha do usuário
    let audio;
    switch(currentInterpolationType) {
        case 'equal':
            audio = interpolarOndasSonoras(Array.from(audioData1), Array.from(audioData2), fator, "regular");
            break;
        case 'grain':
            audio = interpolarGraos(Array.from(audioData1), Array.from(audioData2), fator);
            break;
        case 'random':
        default:
            audio = interpolarOndasSonoras(Array.from(audioData1), Array.from(audioData2), fator, "alea");
    }

    resultAudio = new Float32Array(audio);

    // Calcular e exibir duração do resultado
    const resultDuration = resultAudio.length / sampleRate;
    const resultDurationText = formatDuration(resultDuration);
    document.getElementById('durationResult').textContent = resultDurationText;

    // Desenhar visualizações do resultado
    drawWaveform(resultAudio, 'waveformResult');

    document.getElementById('playResult').disabled = false;
    document.getElementById('normalizeResult').disabled = false;
    updateRecordButton();
    updateStatus('Transformação concluída com sucesso!');
    console.log('Transformação concluída com sucesso!');
}

function normalizeAudio() {
    if (!resultAudio) {
        updateStatus('Nenhum áudio para normalizar!');
        return;
    }

    updateStatus('Normalizando áudio...', true);

    // Encontrar o valor máximo absoluto no áudio
    let maxAmplitude = 0;
    for (let i = 0; i < resultAudio.length; i++) {
        const absValue = Math.abs(resultAudio[i]);
        if (absValue > maxAmplitude) {
            maxAmplitude = absValue;
        }
    }

    // Se o áudio já está normalizado (próximo de 1.0), não fazer nada
    if (maxAmplitude >= 0.95 && maxAmplitude <= 1.0) {
        updateStatus('Áudio já está normalizado!');
        return;
    }

    // Aplicar normalização se necessário
    if (maxAmplitude > 0) {
        const gain = 0.95 / maxAmplitude; // Normalizar para 95% do máximo para evitar clipping

        // Criar cópia normalizada
        const normalizedAudio = new Float32Array(resultAudio.length);
        for (let i = 0; i < resultAudio.length; i++) {
            normalizedAudio[i] = resultAudio[i] * gain;
        }

        resultAudio = normalizedAudio;

        // Atualizar visualização
        drawWaveform(resultAudio, 'waveformResult');
        updateStatus(`Áudio normalizado com sucesso! Ganho aplicado: ${gain.toFixed(3)}`);
        console.log('Áudio normalizado - Ganho aplicado:', gain.toFixed(3));
    } else {
        updateStatus('Áudio muito silencioso para normalizar!');
    }
}

function formatDuration(seconds) { // função para formatar a duração
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
}

// Iguala o tamanho dos áudios inserindo valores interpolados
function igualarTamanhoAleatorio(audio1, audio2) {
    console.log("igualarTamanhoAleatorio()");
    const len1 = audio1.length;
    const len2 = audio2.length;
    const fatorAlea = parseInt(document.getElementById('randomnessSlider').value) / 100;

    // If arrays are already the same length, return them as is
    if (len1 === len2) {
        return { audio1, audio2, indices: [] };
    }

    // Determine which array is shorter and which is longer
    let audioMenor = len1 < len2 ? audio1.slice() : audio2.slice();
    let audioMaior = len1 < len2 ? audio2.slice() : audio1.slice();
    const tamanhoAlvo = audioMaior.length;
    const dif = tamanhoAlvo - audioMenor.length;
    const passo = tamanhoAlvo / dif; // Step for regular positions

    // Generate indices for insertion (random and regular)
    let indicesA = []; // Random indices
    let indicesR = []; // Regular indices
    for (let i = 0; i < dif; i++) {
        const posA = Math.floor(Math.random() * (tamanhoAlvo - 1)) + 1; // Random position
        const posR = Math.round(i * passo); // Regular position
        indicesA.push(posA);
        indicesR.push(posR);
    }

    // Insert interpolated values into the shorter array
    let indices = []; // Store chosen insertion positions
    for (let i = 0; i < dif; i++) {
        // Choose random or regular position based on fatorAlea
        let pos = Math.random() >= fatorAlea ? indicesR[i] : indicesA[i];

        // Ensure pos is within valid bounds for interpolation
        pos = Math.max(0, Math.min(pos, audioMenor.length - 1));
        const val = i == 0 ? audioMenor[pos] / 2 : (audioMenor[pos - 1] + audioMenor[pos]) / 2; // Interpolate value
        audioMenor.splice(pos, 0, val); // Insert value
        indices.push(pos); // Track insertion position
    }

    // Return the arrays with equal lengths and the insertion indices
    if (len1 < len2) {
        return { audio1: audioMenor, audio2: audioMaior, indices };
    } else {
        return { audio1: audioMaior, audio2: audioMenor, indices };
    }
}

function igualarTamanhoRegular(audio1, audio2) { console.log("igualarTamanhoRegular()")
    const len1 = audio1.length;
    const len2 = audio2.length;
    let indices = [];

    if (len1 === len2) {
        return { audio1: audio1, audio2: audio2 };
    }

    // Determina qual áudio é mais curto
    let audioMenor = len1 < len2 ? audio1.slice() : audio2.slice();
    let audioMaior = len1 < len2 ? audio2.slice() : audio1.slice();
    const dif = audioMaior.length - audioMenor.length;
    const passo = audioMenor.length / dif;
    let val = 0;

    // Insere elementos em posições regulares
    for (let i=dif;i>0;i--) {
        let pos = Math.round(i * passo); // escolhe posição
        if (pos > audioMenor.length-1) {
            pos = audioMenor.length;
            val = (audioMenor[pos-1]) / 2; // calcula valor
        } else {
            if (pos <= 0) { pos = 1; };
            val = (audioMenor[pos-1] + audioMenor[pos]) / 2; // calcula valor
        }
        audioMenor.splice(pos, 0, val) // insere valor
        indices.push(pos); // registra posição do valor interpolado
    }

    // Retorna os áudios com tamanhos iguais
    if (len1 < len2) {
        return { audio1: audioMenor, audio2: audioMaior, indices };
    } else {
        return { audio1: audioMaior, audio2: audioMenor, indices };
    }
}

// Cria a onda interpolada amostra por amostra (regular e aleatória)
function interpolarOndasSonoras(ondaInicial, ondaFinal, fator = 50, tipo = "alea") { console.log("interpolarOndasSonoras()")
    updateStatus(`Aplicando transformação com fator de interpolação ${fator}%`, true);
    const fatorDecimal = fator * 0.01;
    let audio1, audio2, indices;
    // iguala o tamanho dos áudios
    switch (tipo) {
        case "alea":
            ({ audio1, audio2, indices } = igualarTamanhoAleatorio(ondaInicial, ondaFinal)); break;
        case "regular":
            ({ audio1, audio2, indices } = igualarTamanhoRegular(ondaInicial, ondaFinal)); break;
        // case "estranho": ({ audio1, audio2, indices } = igualarTamanhoEstranho(ondaInicial, ondaFinal)); break;
        default:
            throw new Error(`Tipo não suportado: ${tipo}`);
    }

    const tamanho = audio1.length;
    // Cria a onda interpolada
    const ondaInterpolada = [];
    // Interpola ponto a ponto
    for (let i = 0; i < tamanho; i++) {
        ondaInterpolada[i] = (audio1[i] * (1-fatorDecimal)) + (audio2[i] * fatorDecimal);
    }
    // Ajusta o tamanho
    const result = extraiSamples(ondaInterpolada, indices, ondaInicial.length, ondaFinal.length, fator, tipo);

    return result;
}

function alisarOndaSonora(audioData, limiteDescontinuidade = 0.0005) {
    console.log("Alisamento agressivo...");

    let audio = audioData.slice();
    const janela = 2;

    for (let i = janela; i < audio.length - janela; i++) {
        let soma = 0;
        let count = 0;

        // Calcular média da janela (excluindo o ponto central)
        for (let j = -janela; j <= janela; j++) {
            if (j !== 0) {
                soma += audio[i + j];
                count++;
            }
        }

        const mediaVizinhos = soma / count;
        const diferenca = Math.abs(audio[i] - mediaVizinhos);

        // Se o ponto atual é muito diferente dos vizinhos, suavizar
        if (diferenca > limiteDescontinuidade) {
            // Interpolação mais forte
            audio[i] = audio[i] * 0.1 + mediaVizinhos * 0.9;
        }
    }

    return audio;
}

function extraiSamples(onda, indices, tam1, tam2, fator, tipo) {
    console.log("extraindo Samples...")
    let dif = 0;
    let qtd = 0;
    let passo;

    if (tam1 === tam2) {
        return onda;
    }
    else if (tam1 > tam2) {
        dif = tam1 - tam2;
        qtd = Math.round(dif * (fator * 0.01));
    }
    else {
        dif = tam2 - tam1;
        qtd = Math.round(dif - dif * (fator * 0.01));
    }

    if (tipo === "regular") {
        qtd = Math.min(qtd, indices.length);
    }

    switch (tipo) {
        case "alea":
        case "estranho":
            for (let x = 0; x < qtd; x++) {
                if (indices.length > 0) {
                    const pos = indices[indices.length - 1-x];
                    onda.splice(pos, 1);
                }
            }
            break;

        case "regular":

            const indicesToRemove = [];
            const passo = Math.max(1, indices.length / qtd);
            let p;

            // transforma índices anteriores
            for (let i = indices.length; i > 0 ; i--) {
                if (i == indices.length) { p = indices[indices.length-1] }
                else { p = indices[i] + indices[i-1]; }
                indicesToRemove.push(p);
            }

            indicesToRemove.reverse();

            // Remove os elementos
            for (let i = 0; i < qtd; i++) {
                let pos = indicesToRemove[Math.min(indicesToRemove.length-1, Math.ceil(i * passo))];
                onda.splice(pos, 1);
            }
            break;

        default:
            throw new Error(`Tipo não suportado: ${tipo}`);
    }

    return onda;
}

// Cria a onda interpolada por embaralhamento de grãos
function interpolarGraos(audio1, audio2, fatorInterpolacao) {
    console.log("Interpolação por grãos...");
    updateStatus(`Aplicando interpolação por grãos com fator ${fatorInterpolacao}%`, true);

    const fatorAleatoriedade = parseInt(document.getElementById('randomnessSlider').value) / 100;
    const tamanhoGraoBaseSamples = Math.floor((grainSize / 1000) * sampleRate);
    const crossfadeSamples = Math.floor(tamanhoGraoBaseSamples * (crossfadePercentage / 100));

    console.log(`Grão: ${tamanhoGraoBaseSamples} samples, Crossfade: ${crossfadeSamples} samples`);

    // Dividir áudios em grãos com duração variável
    const graosAudio1 = dividirEmGraosComDuracaoVariavel(audio1, tamanhoGraoBaseSamples);
    const graosAudio2 = dividirEmGraosComDuracaoVariavel(audio2, tamanhoGraoBaseSamples);

    console.log(`Áudio 1: ${graosAudio1.length} grãos, Áudio 2: ${graosAudio2.length} grãos`);

    // Criar sequência de grãos
    const sequenciaGraos = criarSequenciaGraos(
        graosAudio1,
        graosAudio2,
        0,
        0,
        fatorAleatoriedade
    );

    // Concatenar grãos com crossfade
    const audioResultante = concatenarGraosComCrossfade(sequenciaGraos, crossfadeSamples);

    console.log(`Áudio resultante: ${audioResultante.length} samples`);
    return audioResultante;
}

function dividirEmGraosComDuracaoVariavel(audio, tamanhoGraoBase) {
    const graos = [];
    let i = 0;

    // DEFINIR LIMITES
    const tamanhoMinimo = Math.min(
        audio.length, // Não pode ser maior que o áudio
        Math.max(50, Math.floor(tamanhoGraoBase * 0.1)) // Mínimo 50 samples ou 10% do base
    );

    // Tamanho máximo: não pode ser maior que o áudio restante
    const tamanhoMaximo = Math.min(
        audio.length, // Não pode ser maior que o áudio total
        Math.floor(tamanhoGraoBase * 2) // Máximo 200% do tamanho base
    );

    // se os limites são inviáveis
    if (tamanhoMinimo > tamanhoMaximo) {
        console.warn("Limites inviáveis! Ajustando...");
        // Fallback: usar o áudio inteiro como um único grão
        if (audio.length > 0) {
            graos.push(audio);
        }
        return graos;
    }

    while (i < audio.length) {
        // Calcular duração aleatória baseada no fator de aleatoriedade
        const variacao = (Math.random() * 2 - 1) * (durationRandomness / 100);
        let tamanhoGraoAtual = Math.floor(tamanhoGraoBase * (1 + variacao));

        // APLICAR LIMITES COM VERIFICAÇÃO
        tamanhoGraoAtual = Math.min(tamanhoMaximo, Math.max(tamanhoMinimo, tamanhoGraoAtual));

        // Garantir que não ultrapasse o fim do áudio
        const tamanhoReal = Math.min(tamanhoGraoAtual, audio.length - i);

        // VERIFICAR se temos um tamanho viável
        if (tamanhoReal >= tamanhoMinimo) {
            const grao = audio.slice(i, i + tamanhoReal);
            graos.push(grao);
            i += tamanhoReal;
        } else {
            // Pedaço final muito pequeno - anexar ao último grão se possível
            if (graos.length > 0 && i < audio.length) {
                const ultimoGrao = graos[graos.length - 1];
                const restante = audio.slice(i);
                const combinado = new Float32Array(ultimoGrao.length + restante.length);
                combinado.set(ultimoGrao, 0);
                combinado.set(restante, ultimoGrao.length);
                graos[graos.length - 1] = combinado;
            } else if (audio.length > 0) {
                // Se não há grãos ainda (áudio muito curto), criar um grão com tudo
                graos.push(audio);
            }
            break;
        }
    }

    console.log(`Grãos criados: ${graos.length} com variação de ±${durationRandomness}%`);
    return graos;
}

function criarSequenciaGraos(graos1, graos2, numGraos1, numGraos2, fatorAleatoriedade) {
    const sequencia = [];
    const fatorInterpolacao = parseInt(document.getElementById('progressSlider').value) / 100;

    // Lógica para seleção de grãos baseada no fator de interpolação
    if (fatorInterpolacao <= 0.5) {
        // 0% a 50%: 100% dos grãos do áudio 1 + porcentagem proporcional do áudio 2
        const porcentagemAudio2 = fatorInterpolacao * 2; // 0% a 100% do audio2
        numGraos1 = graos1.length;
        numGraos2 = Math.floor(graos2.length * porcentagemAudio2);
    } else {
        // 50% a 100%: 100% dos grãos do áudio 2 + porcentagem proporcional do áudio 1
        const porcentagemAudio1 = (1 - fatorInterpolacao) * 2; // 100% a 0% do audio1
        numGraos1 = Math.floor(graos1.length * porcentagemAudio1);
        numGraos2 = graos2.length;
    }

    console.log(`Grãos selecionados: Audio1=${numGraos1}, Audio2=${numGraos2}`);

    // Selecionar grãos do áudio 1
    const indicesGraos1 = Array.from({length: graos1.length}, (_, i) => i);
    const graos1Selecionados = selecionarGraosAleatorios(indicesGraos1, numGraos1, fatorAleatoriedade)
    .map(i => ({audio: 1, index: i, data: graos1[i]}));

    // Selecionar grãos do áudio 2
    const indicesGraos2 = Array.from({length: graos2.length}, (_, i) => i);
    const graos2Selecionados = selecionarGraosAleatorios(indicesGraos2, numGraos2, fatorAleatoriedade)
    .map(i => ({audio: 2, index: i, data: graos2[i]}));

    // Combinar e embaralhar
    sequencia.push(...graos1Selecionados, ...graos2Selecionados);

    if (fatorAleatoriedade > 0) {
        // Embaralhar baseado no fator de aleatoriedade
        for (let i = sequencia.length - 1; i > 0; i--) {
            if (Math.random() < fatorAleatoriedade) {
                const j = Math.floor(Math.random() * (i + 1));
                [sequencia[i], sequencia[j]] = [sequencia[j], sequencia[i]];
            }
        }
    }

    console.log(`Sequência criada com ${sequencia.length} grãos`);
    return sequencia;
}

function selecionarGraosAleatorios(indices, quantidade, fatorAleatoriedade) {
    if (quantidade >= indices.length) {
        return [...indices];
    }

    const selecionados = [];
    const indicesDisponiveis = [...indices];

    if (fatorAleatoriedade === 0) {
        // Seleção regular
        const passo = indices.length / quantidade;
        for (let i = 0; i < quantidade; i++) {
            const index = Math.floor(i * passo);
            selecionados.push(indicesDisponiveis[index]);
        }
    } else if (fatorAleatoriedade === 1) {
        // Seleção totalmente aleatória
        for (let i = 0; i < quantidade; i++) {
            const randomIndex = Math.floor(Math.random() * indicesDisponiveis.length);
            selecionados.push(indicesDisponiveis.splice(randomIndex, 1)[0]);
        }
    } else {
        // Seleção mista
        const numAleatorios = Math.floor(quantidade * fatorAleatoriedade);
        const numRegulares = quantidade - numAleatorios;

        // Parte regular
        const passo = indices.length / numRegulares;
        for (let i = 0; i < numRegulares; i++) {
            const index = Math.floor(i * passo);
            if (indicesDisponiveis.includes(indices[index])) {
                selecionados.push(indices[index]);
                const removeIndex = indicesDisponiveis.indexOf(indices[index]);
                indicesDisponiveis.splice(removeIndex, 1);
            }
        }

        // Parte aleatória
        for (let i = 0; i < numAleatorios && indicesDisponiveis.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * indicesDisponiveis.length);
            selecionados.push(indicesDisponiveis.splice(randomIndex, 1)[0]);
        }
    }

    return selecionados;
}

function concatenarGraosComCrossfade(sequenciaGraos, crossfadeSamples) {
    if (sequenciaGraos.length === 0) return [];

    console.log(`Concatenando ${sequenciaGraos.length} grãos com crossfade de ${crossfadeSamples} samples...`);

    // Calcular tamanho total estimado para otimização
    let tamanhoTotal = 0;
    for (const grao of sequenciaGraos) {
        tamanhoTotal += grao.data.length;
    }

    // Criar array com tamanho pré-definido para melhor performance
    const resultado = new Float32Array(tamanhoTotal);
    let posicaoAtual = 0;

    for (let i = 0; i < sequenciaGraos.length; i++) {
        const graoAtual = sequenciaGraos[i].data;

        if (i === 0) {
            // Primeiro grão - sem crossfade
            resultado.set(graoAtual, posicaoAtual);
            posicaoAtual += graoAtual.length;
        } else {
            const graoAnterior = sequenciaGraos[i - 1].data;

            // Aplicar crossfade entre grãos apenas se houver samples suficientes
            const inicioCrossfade = Math.max(0, graoAnterior.length - crossfadeSamples);
            const fimCrossfade = Math.min(crossfadeSamples, graoAtual.length);

            // Verificar se temos samples suficientes para crossfade
            if (crossfadeSamples > 0 &&
                inicioCrossfade < graoAnterior.length &&
                fimCrossfade > 0) {

                // Parte do grão anterior que participa do crossfade
                const parteAnterior = graoAnterior.slice(inicioCrossfade);
            // Parte do grão atual que participa do crossfade
            const parteAtual = graoAtual.slice(0, fimCrossfade);

            const tamanhoCrossfade = Math.min(parteAnterior.length, parteAtual.length);

            // Aplicar crossfade nos samples sobrepostos
            for (let j = 0; j < tamanhoCrossfade; j++) {
                const progresso = j / tamanhoCrossfade;
                const sample = parteAnterior[j] * (1 - progresso) + parteAtual[j] * progresso;

                // Atualizar a posição correspondente no resultado
                const posicaoNoResultado = posicaoAtual - (parteAnterior.length - j);
                if (posicaoNoResultado >= 0 && posicaoNoResultado < resultado.length) {
                    resultado[posicaoNoResultado] = sample;
                }
            }

            // Adicionar o restante do grão atual (após o crossfade)
            const restanteGraoAtual = graoAtual.slice(fimCrossfade);
            resultado.set(restanteGraoAtual, posicaoAtual);
            posicaoAtual += restanteGraoAtual.length;
                } else {
                    // Sem crossfade - simplesmente adicionar o grão atual
                    resultado.set(graoAtual, posicaoAtual);
                    posicaoAtual += graoAtual.length;
                }
        }
    }

    // Retornar apenas a parte preenchida do array
    return Array.from(resultado.slice(0, posicaoAtual));
}

// Funções secundárias
async function toggleRecording() {
    if (!resultAudio) return;

    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    console.log("startRecording()")
    try {
        recordedChunks = [];
        isRecording = true;

        // Criar um buffer de áudio do resultado
        const audioBuffer = audioContext.createBuffer(1, resultAudio.length, sampleRate);
        audioBuffer.copyToChannel(resultAudio, 0);

        // Converter AudioBuffer para Blob WAV
        const wavBlob = audioBufferToWav(audioBuffer);

        // VERIFICAÇÃO CRÍTICA: O blob é válido?
        if (!wavBlob || wavBlob.size === 0) {
            throw new Error('Blob de áudio inválido ou vazio');
        }

        // Criar URL para download
        const fatorA = document.getElementById('progressValue').textContent;
        console.log("fatorA", fatorA);

        // Criar nome do arquivo com sanitização
        let nome = document.getElementById('audio1-name').textContent.replace(".wav", "") + "_" +
        document.getElementById('audio2-name').textContent.replace(".wav", "") + "_" +
        currentInterpolationType + "_" + fatorA;

        console.log("Nome original:", nome);

        if (currentInterpolationType == "random") {
            nome = nome + "_" + document.getElementById('randomnessValue').textContent;
        };

        nome = ajustaNomeArquivo(nome) + ".wav"; // ADICIONAR EXTENSÃO
        console.log("Nome sanitizado:", nome);

        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = nome; // Agora com extensão .wav
        document.body.appendChild(a);
        a.click();

        // Limpeza
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        updateStatus('Áudio transformado salvo com sucesso!');

    } catch (error) {
        console.error('Erro ao gravar áudio:', error);
        updateStatus('Erro ao gravar áudio: ' + error.message);
    }
}

// Função para ajustar o nome do arquivo
function ajustaNomeArquivo(name) {
    return name
    .replace(/[\/\\?%*:|"<>]/g, '-') // Remove caracteres inválidos
    .replace(/\s+/g, '_') // Substitui espaços por underscores
    .replace(/\.{2,}/g, '.') // Remove múltiplos pontos
    .trim(); // Remove espaços no início/fim
}

function stopRecording() {
    if (!isRecording) return;

    isRecording = false;
    const recordBtn = document.getElementById('recordResult');
    recordBtn.classList.remove('recording');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

// Função para converter AudioBuffer para WAV Blob
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;

    const bufferArray = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufferArray);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Funções auxiliares para interface
async function loadAudio(event, audioNumber) {
    const file = event.target.files[0];
    if (!file) return;

    updateStatus(`Carregando ${file.name}...`, true);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const audioData = audioBuffer.getChannelData(0); // Mono
        sampleRate = audioBuffer.sampleRate;

        // Calcular duração
        const duration = audioBuffer.duration;
        const durationText = formatDuration(duration);

        if (audioNumber === 1) {
            audioData1 = audioData;
            document.getElementById('audio1-name').textContent = file.name;
            document.getElementById('play1').disabled = false;
            document.getElementById('duration1').textContent = durationText;
            drawWaveform(audioData, 'waveform1');
        } else {
            audioData2 = audioData;
            document.getElementById('audio2-name').textContent = file.name;
            document.getElementById('play2').disabled = false;
            document.getElementById('duration2').textContent = durationText;
            drawWaveform(audioData, 'waveform2');
        }

        updateStatus(`${file.name} carregado com sucesso!`);
        document.getElementById('transformBtn').disabled = false;

    } catch (error) {
        console.error('Erro ao carregar áudio:', error);
        updateStatus('Erro ao carregar o arquivo de áudio');
    }
}

function drawWaveform(audioData, canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Use dimensions do container
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    // Fundo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Onda
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const step = Math.ceil(audioData.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
        const index = Math.floor(i * step);
        const sample = audioData[index] || 0;
        const y = amp - sample * amp;

        if (i === 0) {
            ctx.moveTo(i, y);
        } else {
            ctx.lineTo(i, y);
        }
    }

    ctx.stroke();

    // Linha central
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();
}

function updateRecordButton() {
    const recordBtn = document.getElementById('recordResult');
    recordBtn.disabled = !resultAudio;

    if (isRecording) {
        recordBtn.classList.add('recording');
    } else {
        recordBtn.classList.remove('recording');
    }
}

function resetDurations() {
    document.getElementById('duration1').textContent = 'Duração: --:--';
    document.getElementById('duration2').textContent = 'Duração: --:--';
    document.getElementById('durationResult').textContent = 'Duração: --:--';
}

async function playAudio(audioData) {
    if (!audioData) return;
    updateStatus(`Tocando áudio`, true);
    try {
        // Parar qualquer áudio tocando
        if (currentSource) {
            currentSource.stop();
            currentSource = null;
        }

        // Criar buffer de áudio
        const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
        audioBuffer.copyToChannel(audioData, 0);

        // Criar source
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(audioContext.destination);

        // Tocar
        currentSource.start();

        // Cleanup quando terminar
        currentSource.onended = () => {
            currentSource = null;
        };

    } catch (error) {
        console.error('Erro ao tocar áudio:', error);
    }
}

function updateStatus(message, loading = false) {
    const status = document.getElementById('status');
    if (loading) {
        status.innerHTML = `<span class="loading"></span>${message}`;
    } else {
        status.innerHTML = message;
    }
}
