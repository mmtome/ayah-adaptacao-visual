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
