# Interpolador de Áudio — Forma de Onda

**Interpolador Onda** é uma ferramenta de pesquisa para interpolação entre dois áudios diretamente no domínio do tempo (forma de onda). Roda inteiramente no navegador, sem instalação: carregue dois arquivos de áudio, escolha um método de interpolação e gere um terceiro áudio que combina os dois originais.

Versão atual: **v1.5**. O histórico de versões anteriores está disponível nas [tags](../../tags) do repositório.

---

## Execução

Abra o arquivo `index.html` em um navegador moderno (Firefox, Chrome, Edge). Não há dependências: HTML, CSS e JavaScript estão no mesmo arquivo, e todo o processamento é feito localmente pela Web Audio API — nenhum áudio é enviado para servidores.

---

## Fluxo básico de uso

1. **Carregue** os dois áudios (📁 em cada painel) e ajuste o ganho de cada um, se necessário
2. **Escolha** o tipo de interpolação e ajuste seus parâmetros
3. **Defina** o fator de interpolação (0% = Áudio 1, 100% = Áudio 2)
4. Opcionalmente, **desenhe envelopes** na aba *Envelopes* para variar os parâmetros ao longo do tempo
5. **Aplique** a transformação (⚡ Aplicar Transformação)
6. **Ouça**, **normalize** (📊) e **exporte** o resultado em WAV (⏺️)

---

## Tipos de interpolação

| Tipo | Descrição | Parâmetros |
|---|---|---|
| **Distribuição Aleatória** | Os dois áudios são redimensionados para a mesma duração e misturados amostra a amostra na proporção do fator de interpolação, com deslocamento aleatório (*jitter*) na leitura das amostras. | Fator de aleatoriedade |
| **Mistura de Grãos** | O resultado é montado por grãos extraídos de posições aleatórias dos dois áudios; cada grão vem do Áudio 2 com probabilidade igual ao fator de interpolação (e do Áudio 1 no restante), com crossfade entre grãos. | Duração do grão (ms), crossfade, aleatoriedade da duração |
| **Sobreposição** | Os dois áudios são mixados na proporção do fator de interpolação no trecho em que se sobrepõem, com o mais curto alinhado ao início, centro ou fim do mais longo; fora desse trecho soa apenas o áudio mais longo. Este modo usa o valor do slider, não o envelope de interpolação. | Alinhamento |

## Envelopes

Na aba *Envelopes*, os parâmetros **fator de interpolação**, **aleatoriedade**, **aleatoriedade da duração** e **ganho** de cada áudio podem ser controlados por curvas desenhadas ao longo da duração do resultado:

- clique para adicionar um ponto, arraste para editar, botão direito para remover
- predefinições: *Reset*, *Flat*, *Crescente* e *Decrescente*
- cada envelope é ativado individualmente pela chave *Ativo*

---

## Autor / Contexto

Desenvolvido por Rogério Constante no âmbito de pesquisa acadêmica na UFRJ.

## Licença

Distribuído sob a licença [GNU GPL v3](LICENSE).
