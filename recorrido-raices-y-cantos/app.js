import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PUNTOS, PROYECTO } from './puntos.js';
import { ubicarPersonas, crearCaminantes, animarPersonas, PERSONAS_EXTRA } from './personas.js';

const MODELO = 'modelos/escena.glb';
const COLORES = {
  arquitectura: '--c-arquitectura', senaletica: '--c-senaletica', casetas: '--c-casetas',
  juegos: '--c-juegos', contexto: '--c-contexto',
};
const NOMBRE_TIPO = {
  arquitectura: 'Arquitectura', senaletica: 'Señalética', casetas: 'Casetas',
  juegos: 'Juegos interactivos', contexto: 'Contexto',
};
// Objetos que se vuelven transparentes si tapan lo que la cámara está mostrando
const TAPABLES = /^(Arbol|Saman|Palma|Heliconias|Casa|Edificio|Galpon|Invernadero|Muro|Setos|Farol|Caseta|Letrero|Arco|Cono|Juego_Techo)/;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// Blender (Z arriba) -> three.js (Y arriba)
const v3 = ([x, y, z]) => new THREE.Vector3(x, z, -y);

// ---------------------------------------------------------------- Dispositivo
// Celulares y tabletas: menos resolución y una sola sombra para que la experiencia vaya fluida
const TACTIL = matchMedia('(pointer: coarse)').matches;
const MOVIL = TACTIL && Math.min(screen.width, screen.height) < 820;
const PR_MAX = Math.min(devicePixelRatio, MOVIL ? 1.5 : 2);
let pixelRatio = PR_MAX;

// ---------------------------------------------------------------- Escena
const canvas = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOVIL || devicePixelRatio < 2,
  logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Igual que los renders de los diseñadores (Eevee, vista "Standard" + "High Contrast"):
// sin tone mapping fílmico y con un poco más de contraste/saturación (ver estilos.css)
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
// Cielo con degradado: turquesa de día (como en los renders) y azul profundo de noche
const HORIZONTE = '#a9dcd4', CENIT = '#3aa6a3';
function cielo(paradas) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  paradas.forEach(([t, col]) => grad.addColorStop(t, col));
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const CIELO_DIA = cielo([[0, CENIT], [0.62, '#6fc3bd'], [1, HORIZONTE]]);
const CIELO_NOCHE = cielo([[0, '#060b1d'], [0.6, '#101c3a'], [1, '#22335a']]);
scene.background = CIELO_DIA;
scene.fog = new THREE.Fog(HORIZONTE, 180, 520);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 1500);
// En pantallas verticales se abre un poco el lente para que la estación no quede recortada
function ajustarLente() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 58 : 45;
  camera.updateProjectionMatrix();
}
ajustarLente();

// Luces copiadas de la escena de Blender: tres soles (Sun, Sun.001 y Sol) y luces cálidas por estación
const bl = ([x, y, z]) => new THREE.Vector3(x, z, -y);      // dirección Blender -> three
const hemi = new THREE.HemisphereLight('#bfe6df', '#58743d', 0.45);
scene.add(hemi);
const SOLES = [
  { dir: [0.673, -0.416, -0.611], intensidad: 1.92, color: '#ffffff', sombra: MOVIL ? 2048 : 4096 },  // Sun
  { dir: [-0.741, -0.416, -0.527], intensidad: 1.92, color: '#ffffff', sombra: MOVIL ? 0 : 2048 },    // Sun.001
  { dir: [0.206, 0.64, -0.74], intensidad: 1.12, color: '#fff7e6', sombra: 0 },         // Sol
].map((s) => {
  const luz = new THREE.DirectionalLight(s.color, s.intensidad);
  luz.userData.dir = bl(s.dir).normalize();
  if (s.sombra) {
    luz.castShadow = true;
    luz.shadow.mapSize.set(s.sombra, s.sombra);
    luz.shadow.bias = -0.00025;
    luz.shadow.normalBias = 0.02;
    luz.shadow.radius = 1.5;
  }
  scene.add(luz, luz.target);
  return luz;
});
// Las sombras siguen a lo que mira la cámara: así son nítidas (se ve la flecha calada en el suelo)
let mitadSombra = 0;
function actualizarSombras(mira) {
  const dist = camera.position.distanceTo(mira);
  const mitad = THREE.MathUtils.clamp(dist * 0.9, 18, 150);
  const cambiar = Math.abs(mitad - mitadSombra) > mitadSombra * 0.08;
  if (cambiar) mitadSombra = mitad;
  for (const l of SOLES) {
    l.target.position.copy(mira);
    l.position.copy(mira).addScaledVector(l.userData.dir, -200);
    if (l.castShadow && cambiar) {
      Object.assign(l.shadow.camera, { left: -mitad, right: mitad, top: mitad, bottom: -mitad, near: 50, far: 400 });
      l.shadow.camera.updateProjectionMatrix();
    }
  }
}
// Luz que pasa por la flecha calada de cada señal de mapa: una mancha de luz con forma de
// flecha proyectada en el suelo delante de la señal (la ranura real es muy delgada para que
// la sombra en tiempo real la dibuje con nitidez)
const manchasFlecha = [];
const texFlecha = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(7px)';
  g.fillStyle = '#fff';
  g.beginPath();                       // flecha apuntando a la izquierda, como en la señal
  g.moveTo(40, 128); g.lineTo(170, 40); g.lineTo(196, 62); g.lineTo(112, 116);
  g.lineTo(470, 116); g.lineTo(470, 140); g.lineTo(112, 140); g.lineTo(196, 194); g.lineTo(170, 216);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
[
  { pos: [39.8, -71.2], frente: [-0.9, -0.4] },   // Señal de salida (estación 9)
  { pos: [30.4, 57.1], frente: [1.0, 0.1] },      // Señal de llegada (estación 1)
].forEach(({ pos, frente }) => {
  const n = new THREE.Vector2(...frente).normalize();
  // (se guarda para apagarla de noche: sin sol no hay flecha proyectada)
  const t = new THREE.Vector2(-n.y, n.x);         // eje horizontal de la señal
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({
    map: texFlecha, color: '#ffd68a', transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const c = [pos[0] + n.x * 0.6 + t.x * 0.09, pos[1] + n.y * 0.6 + t.y * 0.09];
  mancha.position.copy(v3([c[0], c[1], 0.14]));
  // acostada en el suelo; la punta apunta hacia -t (izquierda de quien mira la señal)
  mancha.rotation.order = 'YXZ';
  mancha.rotation.y = Math.atan2(t.y, t.x);       // eje X del plano alineado con +t
  mancha.rotation.x = -Math.PI / 2;
  mancha.name = 'Luz_Flecha';
  manchasFlecha.push(mancha);
  scene.add(mancha);
});

// Luces cálidas (Point.001 … Point.006 de Blender) sobre las estaciones
const LUCES_DIA = [[39.6, 58.8, 9.6], [45.4, 13.5, 13.9], [21.4, -34.0, 5.8], [14.2, -29.4, 5.8], [26.7, -68.4, 9.6]]
  .map((p) => {
    const l = new THREE.PointLight('#ffc07f', 55, 45, 2);
    l.position.copy(v3(p));
    scene.add(l);
    return l;
  });

// ---------------------------------------------------------------- Noche
// El recorrido también se hace de noche para avistar aves nocturnas. Solo cambia la luz:
//  · Luna: luz fría y tenue en lugar de los soles (se mantiene una sombra suave).
//  · Luces de estación ámbar, bajas, de poca intensidad y corto alcance: la luz cálida (sin azul)
//    y apuntando al suelo es la que menos perturba a búhos, currucutús y bienparados.
//  · Luces de guía a ras de suelo en los senderos, muy tenues, solo para marcar el camino.
//  · Sin luces altas ni hacia el dosel: los árboles quedan en penumbra para las aves.
const AMBAR = '#ffad5a';
const LUCES_NOCHE = [   // [x, y, z (altura), intensidad, alcance]  — coordenadas Blender
  [31.5, 57.2, 0.9, 3.0, 5],     // 1 · mapa de llegada (ilumina el mapa para leerlo)
  [32.4, 13.0, 2.2, 3.5, 6],     // 2 · bajo el techo del juego
  [33.9, -31.2, 1.7, 1.8, 6],    // 3 · frente al arco de entrada
  [21.6, -24.2, 2.2, 3.0, 5],    // 4 y 5 · bajo el techo de la caseta del kit (la guía)
  [-21.6, -25.8, 1.1, 2.0, 5.5], // 6 · deck 1, a la altura de las bancas (no alumbra hacia el dosel)
  [-57.6, -46.6, 1.1, 2.0, 5.5], // 7 · deck 2
  [-21.6, -67.4, 1.1, 2.0, 5.5], // 8 · deck 3
  [16.1, -36.9, 2.2, 3.0, 5],    // 9 · bajo el techo de la caseta del pasaporte
  [38.7, -71.6, 0.9, 3.0, 5],    // 10 · mapa de salida
].map(([x, y, z, i, d]) => {
  const l = new THREE.PointLight(AMBAR, i, d, 2);
  l.position.copy(v3([x, y, z]));
  l.userData.intensidad = i;
  l.visible = false;
  scene.add(l);
  return l;
});
// Luces de guía: manchas de luz ámbar a ras de suelo cada pocos metros sobre los senderos
// (una sola malla para todas, casi sin costo)
const lucesGuia = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const F = [-33.6, -46.6], DECKS = [[-21.6, -25.8], [-57.6, -46.6], [-21.6, -67.4]];
  const pts = [];
  const tramo = (a, b, paso) => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / paso));
    for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  };
  const entrada = [[33.5, -31.0], [25, -30.6], [18.8, -30.6], [9, -36], [0, -43], [-9.6, -46.6]];
  for (let i = 1; i < entrada.length; i++) tramo(entrada[i - 1], entrada[i], 6);
  for (let k = 0; k < 20; k++) {                       // sendero circular de los decks
    const a = (k / 20) * Math.PI * 2, p = [F[0] + 24 * Math.cos(a), F[1] + 24 * Math.sin(a)];
    if (DECKS.every(([x, y]) => Math.hypot(p[0] - x, p[1] - y) > 6)) pts.push(p);
  }
  tramo([33.4, 50], [33.4, -26], 8);                   // borde de la vía hacia el portal
  tramo([33.6, -36], [33.6, -66], 8);                  // y hacia la señal de salida
  const geos = pts.map(([x, y]) => new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2).translate(x, 0.16, -y));
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({
    map: tex, color: AMBAR, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.name = 'Luces_Guia'; m.visible = false; m.renderOrder = 2;
  scene.add(m);
  return m;
})();
// Estrellas: puntos tenues en una cúpula lejana
const estrellas = (() => {
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, h = 0.08 + Math.random() * 0.92;   // solo sobre el horizonte
    const r = 1100, cy = Math.sqrt(1 - h * h);
    pos.set([Math.cos(a) * cy * r, h * r, Math.sin(a) * cy * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
  p.visible = false; p.name = 'Estrellas';
  scene.add(p);
  return p;
})();

const DIA = { soles: SOLES.map((l) => [l.intensity, l.color.clone()]), hemi: [hemi.intensity, hemi.color.clone(), hemi.groundColor.clone()] };
let noche = false;
function aplicarNoche(on) {
  noche = on;
  document.body.classList.toggle('noche', on);
  scene.background = on ? CIELO_NOCHE : CIELO_DIA;
  scene.fog.color.set(on ? '#17233f' : HORIZONTE);
  scene.fog.near = on ? 90 : 180; scene.fog.far = on ? 420 : 520;
  // Luna (usa el primer sol, que es el que tiene la sombra principal)
  SOLES.forEach((l, i) => {
    if (on) {
      l.visible = i === 0;
      l.color.set('#9db4ff'); l.intensity = 0.42;
    } else {
      l.visible = true;
      l.intensity = DIA.soles[i][0]; l.color.copy(DIA.soles[i][1]);
    }
  });
  if (on) { hemi.intensity = 0.38; hemi.color.set('#3a5488'); hemi.groundColor.set('#15210f'); }
  else { [hemi.intensity] = DIA.hemi; hemi.color.copy(DIA.hemi[1]); hemi.groundColor.copy(DIA.hemi[2]); }
  LUCES_DIA.forEach((l) => (l.visible = !on));
  LUCES_NOCHE.forEach((l) => (l.visible = on));
  lucesGuia.visible = on;
  estrellas.visible = on;
  manchasFlecha.forEach((m) => (m.visible = !on));
  btnNoche.setAttribute('aria-pressed', on);
  btnNoche.querySelector('.txt').textContent = on ? 'Día' : 'Noche';
  btnNoche.title = on ? 'Volver a la vista de día' : 'Ver el recorrido de noche';
}

// ---------------------------------------------------------------- UI
const btnNoche = document.getElementById('btn-noche');
const fundido = document.getElementById('fundido');
const avisoNoche = document.getElementById('aviso-noche');
let cambiandoLuz = false, avisoTimer = 0;
btnNoche.onclick = () => {
  if (cambiandoLuz) return;
  cambiandoLuz = true;
  fundido.classList.add('activo');                    // fundido corto: el cambio de luces no se ve a saltos
  setTimeout(() => {
    aplicarNoche(!noche);
    setTimeout(() => {                                 // deja compilar las luces nuevas y descubre
      fundido.classList.remove('activo');
      cambiandoLuz = false;
    }, 120);
    clearTimeout(avisoTimer);
    avisoNoche.classList.toggle('visible', noche);
    if (noche) avisoTimer = setTimeout(() => avisoNoche.classList.remove('visible'), 5500);
  }, 360);
};
document.getElementById('titulo-proyecto').textContent = PROYECTO.titulo;
document.getElementById('subtitulo-proyecto').textContent = PROYECTO.subtitulo;
document.title = `${PROYECTO.titulo} · Propuesta`;

const scroller = document.getElementById('scroller');
const tarjetasEl = document.getElementById('tarjetas');
const indiceEl = document.getElementById('indice');
const marcadoresEl = document.getElementById('marcadores');

const marcarPendiente = (t) => t.replace(/\[([^\]]+)\]/g, '<span class="pendiente">$1</span>');

const tarjetas = PUNTOS.map((p, i) => {
  const color = css(COLORES[p.tipo] || '--bosque');
  scroller.appendChild(document.createElement('section'));
  const num = p.num === '' || p.num == null ? '' : p.num;

  const el = document.createElement('article');
  el.className = 'tarjeta' + (i % 2 ? ' der' : '');
  el.style.setProperty('--color', color);
  el.innerHTML = `
    <div class="cabeza">${num !== '' ? `<span class="num">${num}</span>` : ''}<span class="tipo">${num !== '' ? 'Estación · ' : ''}${NOMBRE_TIPO[p.tipo] || ''}</span></div>
    <h2>${p.titulo}</h2>
    <p>${marcarPendiente(p.texto)}</p>
    ${p.datos?.length ? `<dl>${p.datos.map(([k, v]) => `<dt>${k}</dt><dd>${marcarPendiente(v)}</dd>`).join('')}</dl>` : ''}
    ${p.interactivo ? `<span class="accion">● Interactivo: ${TACTIL ? 'toca' : 'haz clic en'} los bloques</span>` : ''}`;
  tarjetasEl.appendChild(el);

  const etiqueta = num !== '' ? `${num}. ${p.titulo}` : p.titulo;
  const b = document.createElement('button');
  b.style.setProperty('--color', color);
  b.innerHTML = `<span class="etiqueta">${etiqueta}</span><span class="punto${num === '' ? ' chico' : ''}"></span>`;
  b.onclick = () => irA(i);
  indiceEl.appendChild(b);

  // Marcador de la estación (solo en exploración libre): al tocarlo se abre su tarjeta
  let marcador = null;
  if (num !== '') {
    marcador = document.createElement('button');
    marcador.className = 'marcador';
    marcador.style.setProperty('--color', color);
    marcador.innerHTML = `<span class="gota"><b>${num}</b></span><span class="nombre">${p.titulo}</span>`;
    marcador.onclick = (ev) => { ev.stopPropagation(); abrirTarjetaLibre(i); };
    marcadoresEl.appendChild(marcador);
  }
  return { el, boton: b, color, num, marcador };
});

function alturaSeccion() { return scroller.children[0].offsetHeight || innerHeight * 1.5; }
function irA(i) { scrollTo({ top: i * alturaSeccion(), behavior: 'smooth' }); }

// ---------------------------------------------------------------- Ruta de cámara
const CAMS = PUNTOS.map((p) => v3(p.camara));
const MIRAS = PUNTOS.map((p) => v3(p.mira));
const N = PUNTOS.length;
// Encuadre: la vista se corre para que la estación quede del lado contrario al recuadro de texto.
// En pantallas angostas (celular) el recuadro va abajo: la cámara se aleja un poco para que la
// estación quepa a lo ancho y el objeto sube a la parte de arriba de la pantalla.
const CAMS_ENC = CAMS.map((c) => c.clone());
const MIRAS_ENC = MIRAS.map((m) => m.clone());
function calcularEncuadre() {
  const angosta = innerWidth < 720;
  const aspecto = innerWidth / innerHeight;
  // cuánto alejar para ver de lado a lado lo mismo que en una pantalla horizontal (con tope)
  const medioH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspecto);
  const alejar = aspecto < 1 ? THREE.MathUtils.clamp(0.36 / Math.tan(medioH), 1, 1.6) : 1;
  PUNTOS.forEach((p, i) => {
    const d = MIRAS[i].clone().sub(CAMS[i]);
    const corto = p.sinPin ? 1 : alejar;        // las vistas aéreas ya muestran todo
    CAMS_ENC[i].copy(MIRAS[i]).addScaledVector(d, -corto);
    const dist = d.length() * corto;
    const derecha = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    const lado = i % 2 ? 1 : -1;               // recuadro a la derecha (impares) -> objeto a la izquierda
    const off = angosta
      ? new THREE.Vector3(0, -dist * (p.sinPin ? 0.1 : 0.12), 0)   // subir el objeto sobre el recuadro
      : derecha.multiplyScalar(lado * dist * 0.24 * (p.encuadre ?? 1));
    MIRAS_ENC[i].copy(MIRAS[i]).add(off);
  });
}
calcularEncuadre();
const suave = (x) => x * x * (3 - 2 * x);
function tramo(u) { // la cámara se queda quieta al llegar (lectura) y luego vuela al siguiente
  const a = 0.28, b = 0.92;
  return suave(THREE.MathUtils.clamp((u - a) / (b - a), 0, 1));
}
const tmpP = new THREE.Vector3(), tmpM = new THREE.Vector3();
function poseEn(t) {
  if (!Number.isFinite(t)) t = 0;
  const i = THREE.MathUtils.clamp(Math.floor(t), 0, N - 1);
  const j = Math.min(i + 1, N - 1);
  const u = tramo(t - i);
  tmpP.lerpVectors(CAMS_ENC[i], CAMS_ENC[j], u);
  const dist = CAMS_ENC[i].distanceTo(CAMS_ENC[j]);
  tmpP.y += Math.sin(Math.PI * u) * Math.min(dist * 0.35, 35);   // arco por encima de los árboles
  tmpM.lerpVectors(MIRAS_ENC[i], MIRAS_ENC[j], u);
  return { pos: tmpP, mira: tmpM };
}

// ---------------------------------------------------------------- Carga del modelo
const barra = document.getElementById('carga-barra');
const pct = document.getElementById('carga-pct');
const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader().setDRACOLoader(draco);

const juegos = [];
const tapables = [];       // raíces que pueden desvanecerse
const mallasTapables = []; // mallas para el raycast
let suelo = [];            // para doble clic en modo libre

loader.load(MODELO, (gltf) => {
  const raiz = gltf.scene;
  raiz.children.forEach((nodo) => {
    if (TAPABLES.test(nodo.name)) {
      nodo.userData.opacidad = 1; nodo.userData.objetivo = 1; nodo.userData.mats = [];
      nodo.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => nodo.userData.mats.push(m));
        o.userData.raiz = nodo;
        mallasTapables.push(o);
      });
      nodo.userData.centro = new THREE.Box3().setFromObject(nodo).getCenter(new THREE.Vector3());
      tapables.push(nodo);
    }
  });
  raiz.traverse((o) => {
    if (o.isMesh) {
      const plano = /^(Terreno|Canaduzal|Cerros|Via_|Cancha|Piscina|Hojarasca|Sendero)/.test(o.name);
      o.castShadow = !plano && !/^Nubes/.test(o.name);
      o.receiveShadow = !/^Nubes/.test(o.name);
      if (plano) suelo.push(o);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.anisotropy = 8; });
    }
    if (/^Juego_(Izq|Centro|Der)_(Abajo|Medio|Arriba)$/.test(o.name)) {
      o.userData.giro = 0; o.userData.objetivoGiro = 0;
      juegos.push(o);
    }
  });
  // Sin montañas ni nubes; el pasto exterior se extiende hasta el horizonte
  raiz.traverse((o) => { if (/^(Cerros|Nubes)/.test(o.name)) o.visible = false; });
  const exterior = raiz.getObjectByName('Terreno_Exterior');
  let matSuelo = null;
  exterior?.traverse((o) => { if (o.isMesh && !matSuelo) matSuelo = o.material; });
  const infinito = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000),
    matSuelo ? matSuelo.clone() : new THREE.MeshStandardMaterial({ color: '#7fae55', roughness: 1 }));
  infinito.rotation.x = -Math.PI / 2;
  infinito.position.y = -0.2;
  infinito.receiveShadow = true;
  infinito.name = 'Suelo_Infinito';
  scene.add(infinito);
  suelo.push(infinito);
  scene.add(raiz);
  unirEstaticos(raiz);
  fetch('modelos/personas.json').then((r) => r.json()).then((l) => ubicarPersonas(scene, l.concat(PERSONAS_EXTRA))).catch(() => ubicarPersonas(scene, PERSONAS_EXTRA));
  crearCaminantes(scene);
  document.getElementById('carga').classList.add('listo');
  onScroll();
}, (e) => {
  if (e.total) {
    const p = Math.round((e.loaded / e.total) * 100);
    barra.style.width = p + '%'; pct.textContent = p + '%';
  } else { pct.textContent = (e.loaded / 1e6).toFixed(1) + ' MB'; }
}, (err) => {
  console.error(err);
  pct.textContent = 'No se pudo cargar el modelo. Abre la experiencia con "Abrir experiencia.command".';
});

// ---------------------------------------------------------------- Optimización: unir lo que no se mueve
// El modelo trae cientos de piezas sueltas. Las que nunca cambian (suelo, caminos, decks, señales…)
// se juntan en una malla por material: muchas menos llamadas de dibujo por cuadro, sobre todo
// con sombras. Se dejan sueltos los objetos que se desvanecen y los bloques del juego.
function unirEstaticos(raiz) {
  raiz.updateMatrixWorld(true);
  const grupos = new Map();
  const quitar = [];
  raiz.traverse((o) => {
    if (!o.isMesh || !o.visible || o.isSkinnedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== raiz; p = p.parent) {
      if (TAPABLES.test(p.name) || /^Juego_/.test(p.name) || !p.visible) return;
    }
    const g = o.geometry;
    const firma = [o.material.uuid, o.castShadow, o.receiveShadow, !!g.index,
      Object.keys(g.attributes).sort().join(',')].join('|');
    if (!grupos.has(firma)) grupos.set(firma, []);
    grupos.get(firma).push(o);
  });
  let antes = 0, despues = 0;
  for (const lista of grupos.values()) {
    antes += lista.length;
    if (lista.length < 2) { despues++; continue; }
    const geos = lista.map((o) => o.geometry.clone().applyMatrix4(o.matrixWorld));
    const unida = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!unida) { despues += lista.length; continue; }
    const m = new THREE.Mesh(unida, lista[0].material);
    m.castShadow = lista[0].castShadow; m.receiveShadow = lista[0].receiveShadow;
    m.name = 'Unido_' + lista[0].name;
    scene.add(m);
    quitar.push(...lista);
    despues++;
  }
  quitar.forEach((o) => { o.removeFromParent(); o.geometry.dispose(); });
  console.info(`Mallas estáticas: ${antes} → ${despues}`);
}

// ---------------------------------------------------------------- Calidad adaptable
// Si el equipo no alcanza ~40 cuadros por segundo, se baja la resolución poco a poco
let cuadrosMedidos = 0, tiempoMedido = 0;
function ajustarCalidad(dt) {
  if (document.hidden) return;
  cuadrosMedidos++; tiempoMedido += dt;
  if (tiempoMedido < 2) return;
  const fps = cuadrosMedidos / tiempoMedido;
  cuadrosMedidos = 0; tiempoMedido = 0;
  if (fps < 40 && pixelRatio > 0.75) pixelRatio = Math.max(0.75, pixelRatio - 0.25);
  else if (fps > 57 && pixelRatio < PR_MAX) pixelRatio = Math.min(PR_MAX, pixelRatio + 0.25);
  else return;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
}

// ---------------------------------------------------------------- Transparencia de lo que tapa la vista
const rayo = new THREE.Raycaster();
const dir = new THREE.Vector3(), objetivoRayo = new THREE.Vector3();
const OFFSETS = [[0, 0, 0], [1.6, 0.6, 0], [-1.6, 0.6, 0], [0, 2.2, 0], [0, 0.6, 1.6], [0, 0.6, -1.6]];
let cuadro = 0;
function actualizarTapables(mira, dt) {
  if (++cuadro % (MOVIL ? 6 : 3) === 0) {
    tapables.forEach((t) => (t.userData.objetivo = 1));
    for (const [ox, oy, oz] of OFFSETS) {
      objetivoRayo.set(mira.x + ox, mira.y + oy, mira.z + oz);
      dir.subVectors(objetivoRayo, camera.position);
      const largo = dir.length();
      rayo.set(camera.position, dir.normalize());
      rayo.far = largo - 2.5;
      for (const h of rayo.intersectObjects(mallasTapables, false)) {
        const r = h.object.userData.raiz;
        // nunca desvanecer el objeto que se está mostrando
        const dx = r.userData.centro.x - mira.x, dz = r.userData.centro.z - mira.z;
        if (dx * dx + dz * dz > 25) r.userData.objetivo = 0.15;
      }
    }
  }
  const k = 1 - Math.exp(-dt * 8);
  for (const t of tapables) {
    const u = t.userData;
    if (Math.abs(u.opacidad - u.objetivo) < 0.005 && u.opacidad === u.objetivo) continue;
    u.opacidad += (u.objetivo - u.opacidad) * k;
    if (Math.abs(u.opacidad - u.objetivo) < 0.01) u.opacidad = u.objetivo;
    const transp = u.opacidad < 0.99;
    for (const m of u.mats) {
      if (m.transparent !== transp) { m.transparent = transp; m.needsUpdate = true; }
      m.opacity = u.opacidad; m.depthWrite = !transp;
    }
    t.traverse((o) => { if (o.isMesh) o.castShadow = u.opacidad > 0.5; });
  }
}

// ---------------------------------------------------------------- Scroll
let tObjetivo = 0, tActual = 0, activo = -2;
function onScroll() {
  tObjetivo = THREE.MathUtils.clamp(scrollY / alturaSeccion(), 0, N - 1);
  document.getElementById('pista-scroll').classList.toggle('oculta', scrollY > 40);
}
addEventListener('scroll', onScroll, { passive: true });

function actualizarUI(t) {
  const cerca = Math.round(t);
  const nuevo = Math.abs(t - cerca) < 0.3 ? cerca : -1;
  if (nuevo !== activo) {
    activo = nuevo;
    tarjetas.forEach((c, k) => c.el.classList.toggle('visible', k === activo));
    document.body.classList.toggle('interactivo', PUNTOS[activo]?.interactivo === 'juegos');
  }
  tarjetas.forEach((c, k) => c.boton.classList.toggle('activo', k === cerca));
}

// Posición en pantalla de los marcadores (exploración libre)
const proy = new THREE.Vector3();
function actualizarMarcadores() {
  PUNTOS.forEach((p, i) => {
    const m = tarjetas[i].marcador;
    if (!m) return;
    proy.copy(v3(p.marcador ?? p.mira)); proy.y += 2.5;   // marcador: si dos estaciones comparten lugar
    proy.project(camera);
    const vis = proy.z < 1 && Math.abs(proy.x) < 1.05 && Math.abs(proy.y) < 1.05;
    m.style.display = vis ? '' : 'none';
    if (vis) m.style.translate = `${(proy.x * 0.5 + 0.5) * innerWidth}px ${(-proy.y * 0.5 + 0.5) * innerHeight}px`;
  });
}
let tarjetaLibre = -1;
function abrirTarjetaLibre(i) {
  tarjetaLibre = i;
  tarjetas.forEach((c, k) => c.el.classList.toggle('visible', k === i));
  volarLibreA(i);
  ocultarAyuda();
}
function cerrarTarjetaLibre() {
  if (tarjetaLibre < 0) return;
  tarjetaLibre = -1;
  tarjetas.forEach((c) => c.el.classList.remove('visible'));
}

// ---------------------------------------------------------------- Juegos interactivos
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function aNDC(ev) { mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); return mouse; }
function bloqueBajo(ev) {
  ray.setFromCamera(aNDC(ev), camera);
  return ray.intersectObjects(juegos, true)[0]?.object;
}
const raizJuego = (o) => { while (o && !juegos.includes(o)) o = o.parent; return o; };
const puedeJugar = () => document.body.classList.contains('interactivo') || libre;
canvas.addEventListener('pointermove', (ev) => {
  if (!puedeJugar() || ev.buttons) return;
  canvas.style.cursor = bloqueBajo(ev) ? 'pointer' : (libre ? 'grab' : '');
});
let abajoEn = null;
canvas.addEventListener('pointerdown', (ev) => { abajoEn = [ev.clientX, ev.clientY]; });
canvas.addEventListener('click', (ev) => {
  if (!puedeJugar()) return;
  if (abajoEn && Math.hypot(ev.clientX - abajoEn[0], ev.clientY - abajoEn[1]) > 5) return; // fue arrastre
  const b = raizJuego(bloqueBajo(ev));
  if (b) b.userData.objetivoGiro += (Math.PI * 2) / 3;   // prismas de 3 caras: cada clic muestra la siguiente
  else if (libre) cerrarTarjetaLibre();
});
const EJE_Y = new THREE.Vector3(0, 1, 0);
function animarJuegos(dt) {
  for (const b of juegos) {
    const d = b.userData.objetivoGiro - b.userData.giro;
    if (Math.abs(d) < 1e-4) continue;
    const paso = d * Math.min(1, dt * 8);
    b.rotateOnWorldAxis(EJE_Y, paso);
    b.userData.giro += paso;
  }
}

// ---------------------------------------------------------------- Modo libre
let libre = false;
const controles = new MapControls(camera, canvas);
controles.enabled = false;
// MapControls bloquea los gestos táctiles del navegador; fuera del modo libre hay que dejar
// que el dedo deslice la página (si no, en el celular no se puede recorrer)
canvas.style.touchAction = 'pan-y';
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.screenSpacePanning = false;     // arrastrar mueve sobre el suelo, como un mapa
controles.maxPolarAngle = THREE.MathUtils.degToRad(86);
controles.minDistance = 2; controles.maxDistance = 320;
controles.rotateSpeed = 0.6; controles.panSpeed = 1.2; controles.zoomSpeed = 1.2;
controles.keyPanSpeed = 0;                // sin teclado: todo con el mouse
// Controles de la exploración libre:
//  · clic izquierdo + arrastrar → girar alrededor del campus
//  · clic derecho + arrastrar  → desplazar la vista
//  · rueda del mouse o + / −    → acercar / alejar (también pellizcar en pantallas táctiles)
//  · clic en un pin             → ver la ficha del lugar
//  · botón "Volver al recorrido" → volver a las secciones del recorrido
controles.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controles.zoomToCursor = true;            // la rueda acerca hacia donde apunta el mouse
// MapControls cambia mover/girar si se tiene Shift, Ctrl o Cmd presionado: se anula para que
// el mouse haga siempre lo mismo
canvas.addEventListener('pointerdown', (ev) => {
  for (const k of ['shiftKey', 'ctrlKey', 'metaKey']) Object.defineProperty(ev, k, { value: false });
}, { capture: true });
// Con la guía abierta, la rueda no mueve la cámara (se lee la guía tranquilo)
addEventListener('wheel', (ev) => {
  if (libre && ayuda.classList.contains('visible')) { ev.stopPropagation(); ev.preventDefault(); }
}, { capture: true, passive: false });

const vuelo = { activo: false, t: 0, desdeP: new THREE.Vector3(), haciaP: new THREE.Vector3(),
  desdeM: new THREE.Vector3(), haciaM: new THREE.Vector3() };
function volarA(pos, mira) {
  vuelo.activo = true; vuelo.t = 0;
  vuelo.desdeP.copy(camera.position); vuelo.haciaP.copy(pos);
  vuelo.desdeM.copy(controles.target); vuelo.haciaM.copy(mira);
}
function volarLibreA(i) { volarA(CAMS[i].clone(), MIRAS[i].clone()); }

const btnLibre = document.getElementById('btn-libre');
function alternarLibre(on = !libre) {
  libre = on;
  document.body.classList.toggle('libre', libre);
  document.body.style.overflow = libre ? 'hidden' : '';
  btnLibre.textContent = libre ? (innerWidth < 720 ? 'Volver' : 'Volver al recorrido') : 'Explorar libre';
  controles.enabled = libre;
  canvas.style.touchAction = libre ? 'none' : 'pan-y';
  vuelo.activo = false;
  canvas.style.cursor = libre ? 'grab' : '';
  if (libre) {
    controles.target.copy(miraActual); controles.update();
    tarjetas.forEach((c) => c.el.classList.remove('visible'));
    tarjetaLibre = -1;
    mostrarAyuda();
  } else {
    ocultarAyuda(); cerrarTarjetaLibre(); activo = -2;
  }
}
btnLibre.onclick = () => alternarLibre();
// Guía "Antes de empezar": aparece al entrar a la exploración libre y se cierra con "Explorar"
const ayuda = document.getElementById('ayuda-libre');
function mostrarAyuda() { ayuda.classList.add('visible'); document.getElementById('btn-explorar').focus({ preventScroll: true }); }
function ocultarAyuda() { ayuda.classList.remove('visible'); }
document.getElementById('btn-ayuda').onclick = () => (ayuda.classList.contains('visible') ? ocultarAyuda() : mostrarAyuda());
document.getElementById('btn-explorar').onclick = ocultarAyuda;
// Botones + / − para acercar y alejar
document.getElementById('btn-acercar').onclick = () => acercar(0.6);
document.getElementById('btn-alejar').onclick = () => acercar(1.6);
function acercar(f) {
  const off = camera.position.clone().sub(controles.target).multiplyScalar(f);
  const d = THREE.MathUtils.clamp(off.length(), controles.minDistance, controles.maxDistance);
  volarA(controles.target.clone().add(off.setLength(d)), controles.target.clone());
}
function girar(a) {
  const off = camera.position.clone().sub(controles.target).applyAxisAngle(EJE_Y, a);
  volarA(controles.target.clone().add(off), controles.target.clone());
}
// Doble clic (o doble toque en el celular): volar hacia ese punto
let ultimoToque = 0, ultimoToqueXY = [0, 0];
canvas.addEventListener('pointerup', (ev) => {
  if (!libre || ev.pointerType !== 'touch') return;
  const ahora = performance.now();
  const cerca = Math.hypot(ev.clientX - ultimoToqueXY[0], ev.clientY - ultimoToqueXY[1]) < 30;
  if (ahora - ultimoToque < 320 && cerca) { volarAlPunto(ev); ultimoToque = 0; return; }
  ultimoToque = ahora; ultimoToqueXY = [ev.clientX, ev.clientY];
});
canvas.addEventListener('dblclick', (ev) => { if (libre) volarAlPunto(ev); });
function volarAlPunto(ev) {
  ray.setFromCamera(aNDC(ev), camera);
  const h = ray.intersectObjects(scene.children, true)[0];
  if (!h) return;
  const off = camera.position.clone().sub(controles.target);
  off.setLength(Math.min(Math.max(off.length() * 0.5, 10), 40));
  volarA(h.point.clone().add(off), h.point.clone());
}
// Teclado: en el modo libre todo se hace con el mouse; Esc vuelve al recorrido.
// Fuera del modo libre, flechas / espacio pasan de estación.
addEventListener('keydown', (e) => {
  if (libre) {
    if (e.key === 'Escape') { if (ayuda.classList.contains('visible')) ocultarAyuda(); else alternarLibre(false); }
    if (e.key === '+' || e.key === '=') acercar(0.6);
    if (e.key === '-') acercar(1.6);
    return;
  }
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); irA(Math.min(Math.round(tActual) + 1, N - 1)); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); irA(Math.max(Math.round(tActual) - 1, 0)); }
});
function limitarLibre() {
  controles.target.x = THREE.MathUtils.clamp(controles.target.x, -150, 150);
  controles.target.z = THREE.MathUtils.clamp(controles.target.z, -150, 150);
  controles.target.y = THREE.MathUtils.clamp(controles.target.y, 0, 20);
  if (camera.position.y < 1.2) camera.position.y = 1.2;
}

// ---------------------------------------------------------------- Bucle
const reloj = new THREE.Clock();
const miraActual = new THREE.Vector3();
let primera = true;
function frame() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  const tiempo = reloj.elapsedTime;
  if (libre) {
    if (vuelo.activo) {
      vuelo.t = Math.min(1, vuelo.t + dt / 1.2);
      const u = suave(vuelo.t);
      camera.position.lerpVectors(vuelo.desdeP, vuelo.haciaP, u);
      controles.target.lerpVectors(vuelo.desdeM, vuelo.haciaM, u);
      if (vuelo.t >= 1) vuelo.activo = false;
    }
    controles.update();
    limitarLibre();
    miraActual.copy(controles.target);
    actualizarMarcadores();
  } else {
    tActual += (tObjetivo - tActual) * (1 - Math.exp(-dt * 4));
    if (primera) { tActual = tObjetivo; primera = false; }
    const { pos, mira } = poseEn(tActual);
    camera.position.set(pos.x + Math.sin(tiempo * 0.35) * 0.2, pos.y + Math.sin(tiempo * 0.5) * 0.1, pos.z);
    miraActual.copy(mira);
    camera.lookAt(miraActual);
    actualizarUI(tActual);
  }
  actualizarSombras(miraActual);
  actualizarTapables(miraActual, dt);
  animarJuegos(dt);
  animarPersonas(dt);
  ajustarCalidad(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  ajustarLente();
  renderer.setSize(innerWidth, innerHeight);
  calcularEncuadre();
  onScroll();
});

// Atajo para presentar / depurar: recorrido.saltar(n) va directo a la parada n
window.recorrido = {
  saltar(i) { scrollTo({ top: i * alturaSeccion(), behavior: 'instant' }); tObjetivo = tActual = i; },
  libre: alternarLibre,
  noche: aplicarNoche,
  juegos, scene, camera, THREE,
  volarA: (c, m) => volarA(v3(c), v3(m)),
};
