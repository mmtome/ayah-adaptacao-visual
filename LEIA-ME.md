# Protocolo RAINHA — Ayah Integrative

## Como rodar no VS Code

1. Abra esta pasta no VS Code (`File > Open Folder`).
2. Instale a extensão **Live Server** (Ritwick Dey).
3. Clique com o botão direito em `index.html` → **Open with Live Server**.

Abrir o `index.html` com duplo clique (`file://`) também funciona na maioria dos navegadores, mas o Live Server é mais confiável e recarrega ao salvar.

## Estrutura

```
index.html      → a página inteira (markup + lógica de animação)
support.js      → runtime que monta o componente (não editar)
assets/         → imagens
```

## Onde editar

Tudo dentro de `index.html`:

- **`<helmet>`** (topo): fontes do Google, reset e `@keyframes` das animações
  (`ayahMarq`, `ayahSpin`, `ayahFloatA/B`, `ayahPulse`, `ayahFade`).
- **Markup da página**: entre `</helmet>` e `</x-dc>`. Estilos são todos inline,
  então cada seção é autocontida — copiar/colar uma seção funciona.
- **`class Component extends DCLogic`** (perto do fim do arquivo):
  - `faqData` → perguntas e respostas do FAQ
  - `renderVals()` → link do WhatsApp (`whatsapp`) e flag `mostrarPrints`
  - `componentDidMount()` → animações: `splitHeadings` (títulos por palavra),
    `installReveal` (entrada por scroll), `installMagnet` (botões magnéticos),
    `installLift` (hover dos cards), `installParallax`, `installProgress`.

Atributos que ligam as animações no HTML: `data-split`, `data-reveal`,
`data-magnet`, `data-lift`, `data-parallax` + `data-speed`.

## Responsividade

As seções usam containers de **até 1280px** (`.ayah-wrap`) com padding
`clamp(20px,3.8vw,44px)`. Os estilos da página são inline, então as regras
responsivas ficam no `<style>` do `<helmet>` e usam `!important` para
conseguir sobrescrever. Os ganchos são:

| Classe | Onde |
|---|---|
| `.ayah-wrap` | todos os containers centrais das seções |
| `.ayah-hero-grid` | grid de duas colunas do herói |
| `.ayah-hero-copy` | coluna de texto do herói |
| `.ayah-hero-media` | coluna da foto |
| `.ayah-hero-img` | a foto recortada |
| `.ayah-hero-badge` | selo “duas médicas na mesma consulta” |
| `.ayah-nav` / `.ayah-nav-links` | topo |

Pontos de quebra:

- **≤ 1120px** — o herói vira uma coluna só e a foto centraliza abaixo do texto.
  Acima disso a foto ficava por cima do título e do CRM.
- **≤ 620px** — nav e selo encolhem.
- **≤ 400px** — padding lateral cai para 16px.
- `prefers-reduced-motion` desliga as animações.

Os demais grids já são `repeat(auto-fit,minmax(...,1fr))` e se reorganizam
sozinhos — mexer no `minmax` muda quantas colunas cabem.

## Tamanho e altura da foto do herói

Três valores governam a foto, todos no `<img class="ayah-hero-img">`:

- `--hero-hang` (no `<style>`, em `.ayah-hero-media`) — quanto a foto desce
  além da base do header. A foto **e** o degradê do chão usam essa variável,
  então mexer nela move os dois juntos. Maior = foto mais baixa.
- `height: min(calc(50vw + 60px), 870px, clamp(470px,95vh,980px))` — a largura
  da foto cresce junto com a altura, e o container trava em 1280px; por isso o
  teto horizontal **não** é proporcional à tela. `50vw + 60px` é o limite que
  mantém a foto fora do “RAINHA”, e `870px` é o teto acima de ~1600px.
  Aumentar esses números faz a foto invadir o título.
- `right: clamp(-200px, calc(596px - 50vw), -44px)` — encosta a foto na borda
  direita da janela entre 1280px e 1600px e para de empurrar acima disso, para
  ela não se desgrudar do texto em telas muito largas.

A máscara lateral esquerda (`#000 9%`) dissolve os 9% da esquerda da foto — é
nessa faixa que mora a sobra sobre a cauda do “A” de RAINHA.

## A foto do herói

`assets/medicas-hero.png` foi recortada sobre fundo branco e trazia franja
clara nas bordas. O arquivo publicado já está tratado: a cor foi reconstruída
sem o branco e o contorno assume o verde do fundo (`#0A2420`), de modo que a
borda se dissolve na cena em vez de virar halo branco ou contorno preto. O
original intocado está em `../medicas-hero-ORIGINAL-backup.png`.

Se trocar essa foto, o recorte novo precisa do mesmo tratamento — senão a
franja branca volta.

## Imagens de exemplo (`assets/stock/`)

Os placeholders listrados foram preenchidos com fotos do **Unsplash** (licença
livre, sem exigência de atribuição) só para o site não ficar vazio na adaptação
visual. **Todas devem ser trocadas por fotos reais da clínica antes de ir para o
ar de verdade.** Cada uma tem `loading="lazy"`.

| Arquivo | Onde aparece |
|---|---|
| `clinica-consulta.jpg` | polaroid “Ayah Integrative · consultório” |
| `recepcao.jpg` `bioimpedancia.jpg` `atendimento.jpg` | tira de 4 fotos (a 2ª é a foto real das médicas) |
| `etapa-anamnese.jpg` `etapa-retorno.jpg` `etapa-acompanhamento.jpg` | a jornada em três tempos |
| `inv-*.jpg` (8) | cards de “O que investigamos” |
| `dep-01..05.jpg` | carrossel de depoimentos |

Para trocar, basta substituir o arquivo mantendo o nome — nada no HTML precisa
mudar. Proporções usadas: 4/3, 3/4, 16/10, ~4/3 nos cards e 9/16 nos depoimentos.

### Os depoimentos levam um selo “EXEMPLO”

O bloco se chama *“Depoimentos recebidos no direct”*. Como as fotos ali são de
banco de imagens e não prints de pacientes reais, cada card carrega um selo
**EXEMPLO** no canto — para ninguém ler aquilo como depoimento verdadeiro
enquanto o site está em adaptação. Ao colocar os prints reais, remova o
`<span>` do selo. Os 5 cards aparecem duas vezes porque o carrossel duplica o
bloco para o loop ficar contínuo: as duas voltas têm de usar as mesmas imagens.

## Efeitos do React Bits (`gradual-blur.js` e `splash-cursor.js`)

Dois componentes do [React Bits](https://reactbits.dev) portados para JS puro —
esta pagina nao e um app React (o `support.js` monta um componente so), entao
JSX, hooks e `import` nao teriam onde rodar. A logica dos dois e a mesma do
original; o que mudou foi a casca.

### GradualBlur

Marcado por atributo no HTML, sem tocar em JS:

```html
<div data-gradual-blur="bottom" data-height="5rem"
     data-strength="2.2" data-divs="6" data-curve="bezier" data-exponential="1"></div>
```

O pai precisa de `position:relative`. Atributos: `data-gradual-blur`
(top/bottom/left/right), `data-height`, `data-strength`, `data-divs`,
`data-curve` (linear/bezier/ease-in/ease-out/ease-in-out), `data-exponential`,
`data-opacity`, `data-z`. Com `data-target="page"` o overlay vira `position:fixed` e acompanha a
viewport — e o preset `page-footer` do componente original.

**Esta aplicado em um lugar so:** uma faixa fixa na base da janela, declarada
logo depois da div do grao, no topo do documento (fora de qualquer secao, para
nenhum `overflow` recortar). O conteudo entra em desfoque ao descer para o
rodape da tela, em qualquer secao.

O rodape ganhou `padding-bottom` extra por causa disso: sem a folga, o aviso
legal ficaria permanentemente borrado sob a faixa.

Um `MutationObserver` monta overlays que aparecam depois da carga.

### SplashCursor

Simulacao de fluido em WebGL que segue o cursor. Ligado em
`componentDidMount → installSplashCursor()`, com a paleta da marca no lugar do
arco-iris do original. Nao instala em tela de toque nem abaixo de 1024px (e um
efeito de cursor, e a simulacao custa GPU), e pausa com a aba em segundo plano.
Como `installSplashCursor` roda depois do `if (reduce) return`, quem pediu
`prefers-reduced-motion` nao recebe o efeito.

Ajustes ficam no objeto passado em `installSplashCursor`: `INTENSITY` (brilho),
`CURL` (redemoinho), `SPLAT_RADIUS`, `DENSITY_DISSIPATION` (quanto o rastro dura).

## Antes de publicar

- Trocar `https://wa.me/5500000000000` pelo número real (aparece 5x).
- Substituir os placeholders listrados (`foto · ...`, `print do depoimento ...`)
  por imagens reais em `assets/`.
- Conferir os CRMs e o aviso legal do rodapé.

## Paleta

| Uso | Hex |
|---|---|
| Verde profundo (fundo) | `#031A17` / `#012C28` |
| Cards escuros | `#16352F` / `#08201C` |
| Sálvia | `#70A98C` |
| Sálvia clara | `#A9C7B6` |
| Dourado | `#EEBD2B` |
| Areia / off-white | `#F6F1EE` |

Tipografia: **Bodoni Moda** (títulos), **IBM Plex Sans** (texto),
**IBM Plex Mono** (etiquetas em caixa alta).
