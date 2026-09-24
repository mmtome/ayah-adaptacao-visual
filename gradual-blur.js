/* GradualBlur — porte para JS puro do componente do React Bits
   (reactbits.dev, MIT). O projeto nao tem bundler, entao em vez de um
   componente React o efeito e instalado por atributo, como as outras
   animacoes do site (data-reveal, data-parallax, data-magnet).

   Uso no HTML — um <div> vazio dentro de um pai position:relative:

     <div data-gradual-blur="bottom" data-height="6rem" data-strength="2"
          data-divs="5" data-curve="bezier" data-exponential="1"
          data-opacity="1" data-z="5"></div>

   position: top | bottom | left | right
   A matematica (curvas, progressao exponencial, paradas da mascara) e a
   mesma do componente original. */
(function () {
  var CURVES = {
    linear: function (p) { return p; },
    bezier: function (p) { return p * p * (3 - 2 * p); },
    'ease-in': function (p) { return p * p; },
    'ease-out': function (p) { return 1 - Math.pow(1 - p, 2); },
    'ease-in-out': function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  };
  var DIRECTIONS = { top: 'to top', bottom: 'to bottom', left: 'to left', right: 'to right' };

  function supportsBackdrop() {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    return CSS.supports('backdrop-filter', 'blur(2px)') ||
           CSS.supports('-webkit-backdrop-filter', 'blur(2px)');
  }

  function build(el) {
    if (el.dataset.gbReady === '1') return;

    var position = el.getAttribute('data-gradual-blur') || 'bottom';
    var strength = parseFloat(el.getAttribute('data-strength') || '2');
    var divCount = Math.max(1, parseInt(el.getAttribute('data-divs') || '5', 10));
    var curve = CURVES[el.getAttribute('data-curve')] || CURVES.linear;
    var exponential = el.getAttribute('data-exponential') === '1';
    var opacity = parseFloat(el.getAttribute('data-opacity') || '1');
    var size = el.getAttribute('data-height') || '6rem';
    var vertical = position === 'top' || position === 'bottom';

    el.className = (el.className ? el.className + ' ' : '') + 'gradual-blur';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = el.getAttribute('data-z') || '5';
    el.style[position] = '0';
    if (vertical) {
      el.style.left = '0'; el.style.right = '0';
      el.style.height = size;
    } else {
      el.style.top = '0'; el.style.bottom = '0';
      el.style.width = el.getAttribute('data-width') || size;
    }

    var inner = document.createElement('div');
    inner.className = 'gradual-blur-inner';

    var increment = 100 / divCount;
    var direction = DIRECTIONS[position] || 'to bottom';

    for (var i = 1; i <= divCount; i++) {
      var progress = curve(i / divCount);
      var blur = exponential
        ? Math.pow(2, progress * 4) * 0.0625 * strength
        : 0.0625 * (progress * divCount + 1) * strength;

      var p1 = Math.round((increment * i - increment) * 10) / 10;
      var p2 = Math.round(increment * i * 10) / 10;
      var p3 = Math.round((increment * i + increment) * 10) / 10;
      var p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      var stops = 'transparent ' + p1 + '%, black ' + p2 + '%';
      if (p3 <= 100) stops += ', black ' + p3 + '%';
      if (p4 <= 100) stops += ', transparent ' + p4 + '%';
      var mask = 'linear-gradient(' + direction + ', ' + stops + ')';

      var layer = document.createElement('div');
      layer.style.cssText =
        'position:absolute;inset:0;opacity:' + opacity + ';' +
        '-webkit-mask-image:' + mask + ';mask-image:' + mask + ';' +
        '-webkit-backdrop-filter:blur(' + blur.toFixed(3) + 'rem);' +
        'backdrop-filter:blur(' + blur.toFixed(3) + 'rem)';
      inner.appendChild(layer);
    }

    el.appendChild(inner);
    el.dataset.gbReady = '1';
  }

  window.ayahGradualBlur = function (root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-gradual-blur]');
    if (!nodes.length) return 0;
    // sem backdrop-filter o efeito nao existe: melhor nao deixar nada do que
    // deixar um retangulo cinza por cima do conteudo
    if (!supportsBackdrop()) {
      Array.prototype.forEach.call(nodes, function (el) { el.style.display = 'none'; });
      return 0;
    }
    Array.prototype.forEach.call(nodes, build);
    return nodes.length;
  };
})();
