/* SplashCursor — porte para JS puro do componente do React Bits
   (reactbits.dev, MIT). Simulacao de fluido em WebGL que segue o cursor.

   O corpo do componente original ja era JS puro dentro de um useEffect; o que
   mudou aqui e so a casca: em vez de o React montar <div><canvas/></div>, quem
   monta e o proprio script. Chamar com:

     window.ayahSplashCursor({ PALETTE: ['#70A98C', '#EEBD2B'] })

   Devolve uma funcao que desmonta tudo (ou null, se nao deu para instalar). */
(function () {
  var DEFAULTS = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    DENSITY_DISSIPATION: 3.5,
    VELOCITY_DISSIPATION: 2,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 3,
    SPLAT_RADIUS: 0.2,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLOR_UPDATE_SPEED: 10,
    COLOR: '#70A98C',
    PALETTE: null,
    INTENSITY: 0.15,
    Z_INDEX: 70
  };

  window.ayahSplashCursor = function (options) {
    var config = {}, k, o;
    for (k in DEFAULTS) config[k] = DEFAULTS[k];
    for (o in (options || {})) config[o] = options[o];

    var host = document.createElement('div');
    host.setAttribute('data-splash-cursor', '');
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:' + config.Z_INDEX;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100vw;height:100vh;display:block';
    host.appendChild(canvas);
    document.body.appendChild(host);

    function getWebGLContext(cv) {
      var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
      var g = cv.getContext('webgl2', params);
      var isWebGL2 = !!g;
      if (!isWebGL2) g = cv.getContext('webgl', params) || cv.getContext('experimental-webgl', params);
      if (!g) return null;

      var halfFloat, supportLinearFiltering;
      if (isWebGL2) {
        g.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = g.getExtension('OES_texture_float_linear');
      } else {
        halfFloat = g.getExtension('OES_texture_half_float');
        supportLinearFiltering = g.getExtension('OES_texture_half_float_linear');
      }
      g.clearColor(0.0, 0.0, 0.0, 1.0);
      var halfFloatTexType = isWebGL2 ? g.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;

      function supportRenderTextureFormat(internalFormat, format, type) {
        var texture = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, texture);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
        var fbo = g.createFramebuffer();
        g.bindFramebuffer(g.FRAMEBUFFER, fbo);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
        return g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
      }
      function getSupportedFormat(internalFormat, format, type) {
        if (!supportRenderTextureFormat(internalFormat, format, type)) {
          switch (internalFormat) {
            case g.R16F: return getSupportedFormat(g.RG16F, g.RG, type);
            case g.RG16F: return getSupportedFormat(g.RGBA16F, g.RGBA, type);
            default: return null;
          }
        }
        return { internalFormat: internalFormat, format: format };
      }

      var formatRGBA, formatRG, formatR;
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(g.RGBA16F, g.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(g.RG16F, g.RG, halfFloatTexType);
        formatR = getSupportedFormat(g.R16F, g.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
      }
      if (!formatRGBA) return null;
      return {
        gl: g,
        ext: {
          formatRGBA: formatRGBA, formatRG: formatRG, formatR: formatR,
          halfFloatTexType: halfFloatTexType, supportLinearFiltering: supportLinearFiltering
        }
      };
    }

    var ctx = getWebGLContext(canvas);
    if (!ctx) { host.remove(); return null; }
    var gl = ctx.gl, ext = ctx.ext;
    if (!ext.supportLinearFiltering) { config.DYE_RESOLUTION = 256; config.SHADING = false; }

    function compileShader(type, source, keywords) {
      if (keywords) {
        var kw = '';
        keywords.forEach(function (key) { kw += '#define ' + key + '\n'; });
        source = kw + source;
      }
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
      return shader;
    }
    function createProgram(vs, fs) {
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.warn(gl.getProgramInfoLog(p));
      return p;
    }
    function getUniforms(program) {
      var uniforms = [];
      var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < count; i++) {
        var name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return uniforms;
    }
    function hashCode(s) {
      if (!s.length) return 0;
      var hash = 0;
      for (var i = 0; i < s.length; i++) { hash = (hash << 5) - hash + s.charCodeAt(i); hash |= 0; }
      return hash;
    }
    function Program(vs, fs) {
      this.program = createProgram(vs, fs);
      this.uniforms = getUniforms(this.program);
    }
    Program.prototype.bind = function () { gl.useProgram(this.program); };
    function Material(vs, fsSource) {
      this.vertexShader = vs; this.fragmentShaderSource = fsSource;
      this.programs = []; this.activeProgram = null; this.uniforms = [];
    }
    Material.prototype.setKeywords = function (keywords) {
      var hash = 0;
      for (var i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
      var program = this.programs[hash];
      if (program == null) {
        var fs = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
        program = createProgram(this.vertexShader, fs);
        this.programs[hash] = program;
      }
      if (program === this.activeProgram) return;
      this.uniforms = getUniforms(program);
      this.activeProgram = program;
    };
    Material.prototype.bind = function () { gl.useProgram(this.activeProgram); };

    var baseVertexShader = compileShader(gl.VERTEX_SHADER, [
      'precision highp float;',
      'attribute vec2 aPosition;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform vec2 texelSize;',
      'void main () {',
      '  vUv = aPosition * 0.5 + 0.5;',
      '  vL = vUv - vec2(texelSize.x, 0.0);',
      '  vR = vUv + vec2(texelSize.x, 0.0);',
      '  vT = vUv + vec2(0.0, texelSize.y);',
      '  vB = vUv - vec2(0.0, texelSize.y);',
      '  gl_Position = vec4(aPosition, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var copyShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; uniform sampler2D uTexture;',
      'void main () { gl_FragColor = texture2D(uTexture, vUv); }'
    ].join('\n'));

    var clearShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;',
      'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'
    ].join('\n'));

    var displayShaderSource = [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform sampler2D uTexture; uniform vec2 texelSize;',
      'void main () {',
      '  vec3 c = texture2D(uTexture, vUv).rgb;',
      '  #ifdef SHADING',
      '    vec3 lc = texture2D(uTexture, vL).rgb;',
      '    vec3 rc = texture2D(uTexture, vR).rgb;',
      '    vec3 tc = texture2D(uTexture, vT).rgb;',
      '    vec3 bc = texture2D(uTexture, vB).rgb;',
      '    float dx = length(rc) - length(lc);',
      '    float dy = length(tc) - length(bc);',
      '    vec3 n = normalize(vec3(dx, dy, length(texelSize)));',
      '    vec3 l = vec3(0.0, 0.0, 1.0);',
      '    float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);',
      '    c *= diffuse;',
      '  #endif',
      '  float a = max(c.r, max(c.g, c.b));',
      '  gl_FragColor = vec4(c, a);',
      '}'
    ].join('\n');

    var splatShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;',
      'uniform vec3 color; uniform vec2 point; uniform float radius;',
      'void main () {',
      '  vec2 p = vUv - point.xy; p.x *= aspectRatio;',
      '  vec3 splat = exp(-dot(p, p) / radius) * color;',
      '  vec3 base = texture2D(uTarget, vUv).xyz;',
      '  gl_FragColor = vec4(base + splat, 1.0);',
      '}'
    ].join('\n'));

    var advectionShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;',
      'uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;',
      'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
      '  vec2 st = uv / tsize - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);',
      '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
      '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
      '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
      '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
      '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
      '}',
      'void main () {',
      '  #ifdef MANUAL_FILTERING',
      '    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
      '    vec4 result = bilerp(uSource, coord, dyeTexelSize);',
      '  #else',
      '    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
      '    vec4 result = texture2D(uSource, coord);',
      '  #endif',
      '  float decay = 1.0 + dissipation * dt;',
      '  gl_FragColor = result / decay;',
      '}'
    ].join('\n'), ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);

    var divergenceShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;',
      'varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;',
      '  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;',
      '  vec2 C = texture2D(uVelocity, vUv).xy;',
      '  if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }',
      '  if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }',
      '  float div = 0.5 * (R - L + T - B);',
      '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var curlShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;',
      'varying highp vec2 vT; varying highp vec2 vB; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;',
      '  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;',
      '  float vorticity = R - L - T + B;',
      '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var vorticityShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;',
      'void main () {',
      '  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;',
      '  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;',
      '  float C = texture2D(uCurl, vUv).x;',
      '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
      '  force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;',
      '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
      '  velocity += force * dt;',
      '  velocity = min(max(velocity, -1000.0), 1000.0);',
      '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var pressureShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;',
      'varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  float divergence = texture2D(uDivergence, vUv).x;',
      '  float pressure = (L + R + B + T - divergence) * 0.25;',
      '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;',
      'varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
      '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
      '  velocity.xy -= vec2(R - L, T - B);',
      '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
      '}'
    ].join('\n'));

    var blit = (function () {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return function (target, clear) {
        if (target == null) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) { gl.clearColor(0.0, 0.0, 0.0, 1.0); gl.clear(gl.COLOR_BUFFER_BIT); }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture: texture, fbo: fbo, width: w, height: h,
        texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
        attach: function (id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        }
      };
    }
    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      var fbo1 = createFBO(w, h, internalFormat, format, type, param);
      var fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1; }, set read(v) { fbo1 = v; },
        get write() { return fbo2; }, set write(v) { fbo2 = v; },
        swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
      };
    }
    function resizeFBO(target, w, h, internalFormat, format, type, param) {
      var newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }
    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w; target.height = h;
      target.texelSizeX = 1.0 / w; target.texelSizeY = 1.0 / h;
      return target;
    }

    var copyProgram = new Program(baseVertexShader, copyShader);
    var clearProgram = new Program(baseVertexShader, clearShader);
    var splatProgram = new Program(baseVertexShader, splatShader);
    var advectionProgram = new Program(baseVertexShader, advectionShader);
    var divergenceProgram = new Program(baseVertexShader, divergenceShader);
    var curlProgram = new Program(baseVertexShader, curlShader);
    var vorticityProgram = new Program(baseVertexShader, vorticityShader);
    var pressureProgram = new Program(baseVertexShader, pressureShader);
    var gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
    var displayMaterial = new Material(baseVertexShader, displayShaderSource);

    var dye, velocity, divergence, curl, pressure;

    function getResolution(resolution) {
      var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      var min = Math.round(resolution), max = Math.round(resolution * aspectRatio);
      return gl.drawingBufferWidth > gl.drawingBufferHeight
        ? { width: max, height: min }
        : { width: min, height: max };
    }
    function initFramebuffers() {
      var simRes = getResolution(config.SIM_RESOLUTION);
      var dyeRes = getResolution(config.DYE_RESOLUTION);
      var texType = ext.halfFloatTexType, rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = !dye
        ? createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering)
        : resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      velocity = !velocity
        ? createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering)
        : resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    /* Cor: no original a paleta e arco-iris aleatorio. Aqui ela vem da marca
       (salvia e dourado), senao o efeito briga com o verde da pagina. */
    function hexToRGB(hex) {
      var v = String(hex).replace('#', '');
      if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
      return {
        r: parseInt(v.slice(0, 2), 16) / 255 * config.INTENSITY,
        g: parseInt(v.slice(2, 4), 16) / 255 * config.INTENSITY,
        b: parseInt(v.slice(4, 6), 16) / 255 * config.INTENSITY
      };
    }
    function generateColor() {
      var p = config.PALETTE;
      if (p && p.length) return hexToRGB(p[Math.floor(Math.random() * p.length)]);
      return hexToRGB(config.COLOR);
    }

    function Pointer() {
      this.texcoordX = 0; this.texcoordY = 0;
      this.prevTexcoordX = 0; this.prevTexcoordY = 0;
      this.deltaX = 0; this.deltaY = 0;
      this.down = false; this.moved = false;
      this.color = generateColor();
    }
    var pointers = [new Pointer()];

    function scaleByPixelRatio(input) { return Math.floor(input * (window.devicePixelRatio || 1)); }
    function correctDeltaX(d) { var a = canvas.width / canvas.height; if (a < 1) d *= a; return d; }
    function correctDeltaY(d) { var a = canvas.width / canvas.height; if (a > 1) d /= a; return d; }
    function correctRadius(radius) { var a = canvas.width / canvas.height; if (a > 1) radius *= a; return radius; }

    function splat(x, y, dx, dy, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
      blit(velocity.write); velocity.swap();
      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write); dye.swap();
    }
    function splatPointer(p) {
      splat(p.texcoordX, p.texcoordY, p.deltaX * config.SPLAT_FORCE, p.deltaY * config.SPLAT_FORCE, p.color);
    }
    function clickSplat(p) {
      var c = generateColor();
      c.r *= 10.0; c.g *= 10.0; c.b *= 10.0;
      splat(p.texcoordX, p.texcoordY, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), c);
    }
    function updatePointerDownData(p, posX, posY) {
      p.down = true; p.moved = false;
      p.texcoordX = posX / canvas.width; p.texcoordY = 1.0 - posY / canvas.height;
      p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
      p.deltaX = 0; p.deltaY = 0; p.color = generateColor();
    }
    function updatePointerMoveData(p, posX, posY, color) {
      p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
      p.texcoordX = posX / canvas.width; p.texcoordY = 1.0 - posY / canvas.height;
      p.deltaX = correctDeltaX(p.texcoordX - p.prevTexcoordX);
      p.deltaY = correctDeltaY(p.texcoordY - p.prevTexcoordY);
      p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
      p.color = color;
    }

    function step(dt) {
      gl.disable(gl.BLEND);

      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write); velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write); pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write); pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write); velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      var velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write); velocity.swap();

      if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write); dye.swap();
    }

    function render() {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      displayMaterial.bind();
      if (config.SHADING)
        gl.uniform2f(displayMaterial.uniforms.texelSize,
          1.0 / gl.drawingBufferWidth, 1.0 / gl.drawingBufferHeight);
      gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      blit(null);
    }

    function resizeCanvas() {
      var w = scaleByPixelRatio(canvas.clientWidth), h = scaleByPixelRatio(canvas.clientHeight);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
      return false;
    }

    var kw = [];
    if (config.SHADING) kw.push('SHADING');
    displayMaterial.setKeywords(kw);
    resizeCanvas();
    initFramebuffers();

    var isActive = true, rafId = null, lastUpdateTime = Date.now(), colorUpdateTimer = 0.0;

    function updateFrame() {
      if (!isActive) return;
      var now = Date.now();
      var dt = Math.min((now - lastUpdateTime) / 1000, 0.016666);
      lastUpdateTime = now;
      if (resizeCanvas()) initFramebuffers();
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = colorUpdateTimer % 1;
        pointers.forEach(function (p) { p.color = generateColor(); });
      }
      pointers.forEach(function (p) { if (p.moved) { p.moved = false; splatPointer(p); } });
      step(dt);
      render();
      rafId = requestAnimationFrame(updateFrame);
    }

    function onMouseDown(e) {
      var p = pointers[0];
      updatePointerDownData(p, scaleByPixelRatio(e.clientX), scaleByPixelRatio(e.clientY));
      clickSplat(p);
    }
    var firstMove = false;
    function onMouseMove(e) {
      var p = pointers[0];
      var posX = scaleByPixelRatio(e.clientX), posY = scaleByPixelRatio(e.clientY);
      if (!firstMove) { updatePointerMoveData(p, posX, posY, generateColor()); firstMove = true; }
      else updatePointerMoveData(p, posX, posY, p.color);
    }
    function onTouchStart(e) {
      var t = e.targetTouches, p = pointers[0];
      for (var i = 0; i < t.length; i++)
        updatePointerDownData(p, scaleByPixelRatio(t[i].clientX), scaleByPixelRatio(t[i].clientY));
    }
    function onTouchMove(e) {
      var t = e.targetTouches, p = pointers[0];
      for (var i = 0; i < t.length; i++)
        updatePointerMoveData(p, scaleByPixelRatio(t[i].clientX), scaleByPixelRatio(t[i].clientY), p.color);
    }
    function onTouchEnd() { pointers[0].down = false; }

    /* A simulacao roda todo frame. Sem isto ela continua queimando GPU com a
       aba em segundo plano. */
    function onVisibility() {
      if (document.hidden) {
        isActive = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!isActive) {
        isActive = true; lastUpdateTime = Date.now(); updateFrame();
      }
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    document.addEventListener('visibilitychange', onVisibility);

    updateFrame();

    return function destroy() {
      isActive = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('visibilitychange', onVisibility);
      host.remove();
    };
  };
})();
