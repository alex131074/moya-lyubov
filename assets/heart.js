/* 3D-сердце из розовых роз, белых хризантем и кустовых роз: цветы слетаются и собираются в сердце, оно бьётся. Чистый WebGL, без библиотек. */
(function () {
  var cv = document.getElementById('ht');
  var gl = cv && (cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'));
  if (!gl) { document.documentElement.classList.add('no-gl'); window.HT = { scroll: function () {}, live: function () {} }; return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PI = Math.PI;

  /* ---------- математика ---------- */
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, t) { var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function basis(d) { var y = norm(d), up = Math.abs(y[2]) < .9 ? [0, 0, 1] : [1, 0, 0], x = norm(cross(up, y)), z = cross(x, y); return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); }
  function chain() { var m = arguments[0]; for (var i = 1; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }

  /* ---------- геометрия ---------- */
  function Geo() { this.d = []; }
  Geo.prototype.surf = function (F, nu, nv, M) { // F(u,v) -> [x,y,z,m], нормали по разностям
    M = M || ident(); var P = [], i, j, e = 1e-3;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = F(u, v), pu = F(Math.min(1, u + e), v), pu2 = F(Math.max(0, u - e), v), pv = F(u, Math.min(1, v + e)), pv2 = F(u, Math.max(0, v - e));
      var n = cross([pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]]);
      if (!(n[0] || n[1] || n[2])) n = [0, 1, 0];
      P.push([p, norm(n)]);
    }
    var w = nu + 1;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = P[j * w + i], b = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
      this.tri(a, b, c, M); this.tri(a, c, d, M);
    }
  };
  Geo.prototype.tri = function () {
    var M = arguments[3], self = this;
    for (var k = 0; k < 3; k++) {
      var q = arguments[k], p = q[0], n = q[1];
      self.d.push(M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14],
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2], p[3]);
    }
  };
  Geo.prototype.upload = function () {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.d), gl.STATIC_DRAW);
    var n = this.d.length / 7; this.d = null; return { b: b, n: n };
  };

  /* лепесток: растёт вдоль y, края загибаются к центру цветка, кончик отгибается наружу */
  function petal(g, o) {
    var F = function (u, v) {
      var s = u * 2 - 1, w = o.w * Math.pow(Math.sin(PI * (.08 + .86 * v)), o.sh || .6);
      var x = s * w, y = o.l * v, z = -o.cup * s * s * w + o.curl * v * v * v * o.l;
      y -= o.tipDip ? o.tipDip * s * s * v * v : 0;
      return [x, y, z, o.m === undefined ? v : o.m];
    };
    g.surf(F, o.nu || 7, o.nv || 8, chain(rotY(o.a), trans(0, o.y || 0, o.r), rotX(o.t)));
  }
  function disc(g, r, h, m, M) { // приплюснутая полусфера: серединка, чашелистик
    g.surf(function (u, v) { var a = u * 2 * PI, b = v * PI / 2; return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * h, Math.sin(a) * Math.cos(b) * r, m]; }, 18, 5, M);
  }

  /* роза: тугой бутон внутри, раскрытые лепестки снаружи */
  var rose = new Geo(), GA = 2.39996;
  [[5, .14, .32, .5, .2, .25, .02], [5, .45, .42, .62, .3, .4, .06], [6, .8, .52, .72, .38, .5, .12], [6, 1.12, .6, .76, .44, .55, .22]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(rose, { a: k / L[0] * 2 * PI + li * .7, t: L[1], w: L[2], l: L[3], r: L[4] * .35, cup: L[5], curl: L[6], y: -li * .05 });
  });
  disc(rose, .34, -.28, .1, ident());
  var roseB = rose.upload();

  /* кустовая роза: маленькая и раскрытая */
  var spray = new Geo();
  [[5, .5, .3, .4, .2, .35, .05], [6, 1.0, .36, .46, .3, .3, .15]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(spray, { a: k / L[0] * 2 * PI + li * .6, t: L[1], w: L[2], l: L[3], r: L[4] * .3, cup: L[5], curl: L[6] });
  });
  disc(spray, .2, -.18, .1, ident());
  var sprayB = spray.upload();

  /* хризантема-ромашка: серединка и два ряда узких лепестков */
  var daisy = new Geo();
  [[18, 1.25, .1, .78, .02], [16, 1.5, .09, .7, .1]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(daisy, { a: (k + li * .5) / L[0] * 2 * PI, t: L[1], w: L[2], l: L[3], r: .18, cup: .5, curl: L[4], sh: .45, nu: 3, nv: 6, y: .04 - li * .03 });
  });
  disc(daisy, .24, .14, 2, trans(0, .02, 0));
  var daisyB = daisy.upload();

  /* лист эвкалипта/зелени */
  var leaf = new Geo();
  petal(leaf, { a: 0, t: 0, w: .26, l: 1.25, r: 0, cup: .25, curl: .25, sh: .9, nv: 9 });
  var leafB = leaf.upload();

  /* обёртка: два слоя бумаги с волнистым краем, спереди ниже, чтобы цветы были видны */
  function wrapGeo(rot, lift, waves, m) {
    var g = new Geo();
    g.surf(function (u, v) {
      var a = u * 2 * PI, t = v;
      var front = Math.max(0, Math.cos(a - PI / 2 + rot));
      var top = .55 + lift - 1.0 * front * front + .16 * Math.sin(a * waves);
      var y = -3.3 + (top + 3.3) * t;
      var r = (.32 + Math.pow(t, 1.25) * .98) * (1 + .05 * Math.sin(a * waves + 1) * t);
      return [Math.cos(a) * r, y, Math.sin(a) * r, m + t * .9];
    }, 72, 14);
    return g.upload();
  }
  var wrapA = wrapGeo(0, 0, 5, 0), wrapB = wrapGeo(.5, .22, 4, 0);
  var ribbon = new Geo();
  ribbon.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI, R = .52, r = .07; return [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(b) * r * 1.6, Math.sin(a) * (R + Math.cos(b) * r), 2]; }, 40, 8);
  [-1, 1].forEach(function (s) { // хвосты ленты
    ribbon.surf(function (u, v) { var x = s * (.1 + v * .5), y = -v * 1.2, z = .55 + Math.sin(v * 3) * .08; return [x + (u - .5) * .22, y, z + (u - .5) * .02 * s, 2]; }, 2, 8);
  });
  var ribbonB = ribbon.upload();
  var stem = new Geo();
  stem.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * .05, -v * 1.1, Math.sin(a) * .05, .5]; }, 8, 1);
  var stemB = stem.upload();
  /* ---------- шейдер ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uVP;uniform mat4 uW;varying vec3 vW;varying vec3 vN;varying float vM;' +
    'void main(){vec4 w=uW*vec4(aP,1.);vW=w.xyz;vN=mat3(uW[0].xyz,uW[1].xyz,uW[2].xyz)*aN;vM=aM;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vW;varying vec3 vN;varying float vM;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uE;uniform float uFade;uniform float uGl;' +
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;' +
    'vec3 base=vM<1.5?uC1*mix(.62,1.,smoothstep(0.,.95,vM)):uC2;' +
    'vec3 L1=normalize(vec3(-.5,.8,.7));vec3 L2=normalize(vec3(.85,.15,.45));' +
    'float d1=max(0.,dot(N,L1)*.6+.4);float d2=max(0.,dot(N,L2))*.28;float f=1.-max(dot(N,V),0.);' +
    'float sp=pow(max(dot(N,normalize(L1+V)),0.),40.)*uGl;' +
    'vec3 c=base*(.36+d1*.7+d2)+vec3(sp)+mix(vec3(1.,.97,.95),base,.4)*pow(f,2.4)*.16;' +
    'gl_FragColor=vec4(min(c,vec3(1.))*uFade,uFade);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  var pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
  var A = { p: gl.getAttribLocation(pg, 'aP'), n: gl.getAttribLocation(pg, 'aN'), m: gl.getAttribLocation(pg, 'aM') };
  var U = {}; ['uVP', 'uW', 'uC1', 'uC2', 'uE', 'uFade', 'uGl'].forEach(function (n) { U[n] = gl.getUniformLocation(pg, n); });
  gl.useProgram(pg); gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  [A.p, A.n, A.m].forEach(function (l) { gl.enableVertexAttribArray(l); });
  function draw(buf, W, c1, c2, gloss) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(U.uW, false, W); gl.uniform3fv(U.uC1, c1); gl.uniform3fv(U.uC2, c2 || c1); gl.uniform1f(U.uGl, gloss || 0);
    gl.drawArrays(gl.TRIANGLES, 0, buf.n);
  }

  /* ---------- сердце: точки внутри (x²+y²-1)³ - x²y³ ≤ 0, выпуклость подушкой ---------- */
  function hf(x, y) { var a = x * x + y * y - 1; return a * a * a - x * x * y * y * y; }
  function hz(x, y) { return .62 * Math.sqrt(Math.max(0, Math.min(1, -hf(x, y) * 1.6))); }
  var COL = { pink: [.95, .52, .64], blush: [.99, .77, .8], white: [.99, .98, .95], cream: [.99, .92, .8], deep: [.86, .3, .46], lilac: [.8, .68, .9], yolk: [.86, .8, .36], leaf: [.42, .58, .46], euc: [.6, .72, .64] };
  var PAL = [[roseB, COL.pink, .2], [roseB, COL.blush, .2], [daisyB, COL.white, .05], [sprayB, COL.cream, .15], [roseB, COL.deep, .25], [roseB, COL.pink, .2], [sprayB, COL.lilac, .15], [daisyB, COL.white, .05]];
  var S = 2.15, SP = .235, FL = [], LV = [], seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var row = 0, y = -1.05; y < 1.3; y += SP * .87, row++) {
    for (var x = -1.25 + (row % 2) * SP / 2; x < 1.25; x += SP) {
      var jx = x + (rnd() - .5) * SP * .25, jy = y + (rnd() - .5) * SP * .25, f = hf(jx, jy);
      if (f > -.004) continue;
      var e = 1e-3, z = hz(jx, jy), nx = -(hz(jx + e, jy) - hz(jx - e, jy)) / (2 * e) / S, ny = -(hz(jx, jy + e) - hz(jx, jy - e)) / (2 * e) / S;
      var p = PAL[Math.floor(rnd() * PAL.length)];
      var r = 6 + rnd() * 4, a1 = rnd() * 2 * PI, a2 = (rnd() - .5) * 2;
      FL.push({ t: [jx * S, jy * S, z * S * .55], d: norm([nx * .6, ny * .6, 1]), b: p[0], c: p[1], g: p[2], s: (p[0] === daisyB ? .5 : p[0] === sprayB ? .44 : .48) * (1 + (rnd() - .5) * .18),
        from: [Math.cos(a1) * r, a2 * 2.5, Math.sin(a1) * r - 2], k: Math.hypot(jx, jy - .2) * .5 + rnd() * .25, spin: rnd() * 6 });
      var gx = (hf(jx + e, jy) - hf(jx - e, jy)), gy = (hf(jx, jy + e) - hf(jx, jy - e));
      if (f > -.09 && LV.length < 40) LV.push({ t: [jx * S * 1.04, jy * S * 1.04, -.15], d: norm([gx, gy, -.15]), k: .6 + rnd() * .3 });
    }
  }

  /* ---------- кадр ---------- */
  var W = 0, H = 0, live = true, last = 0, time = 0, mx = 0, my = 0, tmx = 0, tmy = 0, fade = 0, scr = 0, scrT = 0, asm = 0;
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', function () { resize(); kick(); });
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  cv.addEventListener('click', function () { if (!reduce && asm > 1.6) asm = 0; });

  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function step(dt) {
    var k = 1 - Math.exp(-dt * 5);
    fade += (1 - fade) * (1 - Math.exp(-dt * 3));
    mx += (tmx - mx) * k; my += (tmy - my) * k; scr += (scrT - scr) * k;
    asm = reduce ? 3 : asm + dt * .62;
  }
  function render() {
    if (!W) resize();
    var asp = W / H, d = 14.2 * Math.max(1, .92 / asp);
    var tg = [0, .35, 0], eye = [0, tg[1] + 1.2, d];
    var VP = mul(persp(.5, asp, 1, 80), lookAt(eye, tg));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uE, eye[0], eye[1], eye[2]); gl.uniform1f(U.uFade, fade);

    var still = reduce ? 0 : 1, ph = (time / 1.15) % 1;
    var beat = still * asm > 1.7 ? 1 + .035 * (Math.exp(-Math.pow(ph / .07, 2)) + .6 * Math.exp(-Math.pow((ph - .2) / .07, 2))) : 1;
    var G = chain(trans(0, .2, 0), rotY(mx * .7 + still * Math.sin(time * .5) * .22 + scr * 1.4), rotX(-.08 + my * .3), scl(beat, beat, beat));
    var spread = 1 + scr * .5;
    LV.forEach(function (l) {
      var b = ease((asm - 1.1 - l.k * .4) / .6);
      if (b <= 0) return;
      draw(leafB, chain(G, trans(l.t[0] * spread, l.t[1] * spread, l.t[2]), basis(l.d), scl(.55 * b, .7 * b, .55 * b)), COL.euc, null, .1);
    });
    FL.forEach(function (f, i) {
      var t = ease((asm - f.k) / 1.1);
      if (t <= 0) return;
      var u = 1 - t;
      var p = [f.t[0] * spread * t + f.from[0] * u, f.t[1] * spread * t + f.from[1] * u, f.t[2] * t + f.from[2] * u];
      var sw = still * Math.sin(time * 1.1 + i) * .03;
      draw(f.b, chain(G, trans(p[0], p[1] + sw, p[2]), basis(f.d), rotY(f.spin + u * 5), scl(f.s * (.4 + .6 * t), f.s * (.4 + .6 * t), f.s * (.4 + .6 * t))), f.c, COL.yolk, f.g);
    });
  }
  function frame_(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; time += dt;
    step(dt); render();
    if (live) requestAnimationFrame(frame_);
  }
  var pending = false;
  function kick() {
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; step(.05); render(); });
  }
  window.HT = {
    scroll: function (p) { scrT = Math.max(0, Math.min(1, p)); kick(); },
    live: function (v) { if (reduce || v === live) return; live = v; if (v) { last = performance.now(); requestAnimationFrame(frame_); } }
  };
  resize();
  if (reduce) { live = false; fade = 1; asm = 3; kick(); } else requestAnimationFrame(frame_);
})();
