import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
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

// ---------------------------------------------------------------- Escena
const canvas = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Igual que los renders de los diseñadores (Eevee, vista "Standard" + "High Contrast"):
// sin tone mapping fílmico y con un poco más de contraste/saturación (ver estilos.css)
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
// Cielo turquesa con degradado, como en los renders
const HORIZONTE = '#a9dcd4', CENIT = '#3aa6a3';
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, CENIT); grad.addColorStop(0.62, '#6fc3bd'); grad.addColorStop(1, HORIZONTE);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
scene.fog = new THREE.Fog(HORIZONTE, 180, 520);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 1500);

// Luces copiadas de la escena de Blender: tres soles (Sun, Sun.001 y Sol) y luces cálidas por estación
const bl = ([x, y, z]) => new THREE.Vector3(x, z, -y);      // dirección Blender -> three
scene.add(new THREE.HemisphereLight('#bfe6df', '#58743d', 0.45));
const SOLES = [
  { dir: [0.673, -0.416, -0.611], intensidad: 1.92, color: '#ffffff', sombra: 4096 },  // Sun
  { dir: [-0.741, -0.416, -0.527], intensidad: 1.92, color: '#ffffff', sombra: 2048 }, // Sun.001
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
  scene.add(mancha);
});

// Luces cálidas (Point.001 … Point.006 de Blender) sobre las estaciones
[[39.6, 58.8, 9.6], [45.4, 13.5, 13.9], [21.4, -34.0, 5.8], [14.2, -29.4, 5.8], [26.7, -68.4, 9.6]]
  .forEach((p) => {
    const l = new THREE.PointLight('#ffc07f', 55, 45, 2);
    l.position.copy(v3(p));
    scene.add(l);
  });

// ---------------------------------------------------------------- UI
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
    ${p.interactivo ? '<span class="accion">● Interactivo: haz clic en los bloques</span>' : ''}`;
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
// Encuadre: la vista se corre para que la estación quede del lado contrario al recuadro de texto
const MIRAS_ENC = MIRAS.map((m) => m.clone());
function calcularEncuadre() {
  const angosta = innerWidth < 720;
  PUNTOS.forEach((p, i) => {
    const d = MIRAS[i].clone().sub(CAMS[i]);
    const dist = d.length();
    const derecha = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    const lado = i % 2 ? 1 : -1;               // recuadro a la derecha (impares) -> objeto a la izquierda
    const off = angosta
      ? new THREE.Vector3(0, -dist * 0.14, 0)   // en celular el recuadro va abajo: subir el objeto
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
  tmpP.lerpVectors(CAMS[i], CAMS[j], u);
  const dist = CAMS[i].distanceTo(CAMS[j]);
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

// ---------------------------------------------------------------- Transparencia de lo que tapa la vista
const rayo = new THREE.Raycaster();
const dir = new THREE.Vector3(), objetivoRayo = new THREE.Vector3();
const OFFSETS = [[0, 0, 0], [1.6, 0.6, 0], [-1.6, 0.6, 0], [0, 2.2, 0], [0, 0.6, 1.6], [0, 0.6, -1.6]];
let cuadro = 0;
function actualizarTapables(mira, dt) {
  if (++cuadro % 3 === 0) {
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
    proy.copy(v3(p.mira)); proy.y += 2.5;
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
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.screenSpacePanning = false;     // arrastrar mueve sobre el suelo, como un mapa
controles.zoomToCursor = true;            // la rueda acerca hacia donde apunta el mouse
controles.maxPolarAngle = THREE.MathUtils.degToRad(86);
controles.minDistance = 2; controles.maxDistance = 320;
controles.rotateSpeed = 0.6; controles.panSpeed = 1.2; controles.zoomSpeed = 1.2;
controles.keyPanSpeed = 0;                // usamos nuestro propio teclado (WASD)

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
  btnLibre.textContent = libre ? 'Volver al recorrido' : 'Explorar libre';
  controles.enabled = libre;
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
// Guía de controles: aparece al entrar a la exploración libre y se va sola
const ayuda = document.getElementById('ayuda-libre');
let ayudaTimer = 0;
function mostrarAyuda() {
  ayuda.classList.add('visible');
  clearTimeout(ayudaTimer);
  ayudaTimer = setTimeout(ocultarAyuda, 6000);
}
function ocultarAyuda() { ayuda.classList.remove('visible'); clearTimeout(ayudaTimer); }
document.getElementById('btn-ayuda').onclick = () => (ayuda.classList.contains('visible') ? ocultarAyuda() : mostrarAyuda());
ayuda.addEventListener('click', ocultarAyuda);
canvas.addEventListener('pointerdown', () => { if (libre) { ocultarAyuda(); } });
function acercar(f) {
  const off = camera.position.clone().sub(controles.target).multiplyScalar(f);
  const d = THREE.MathUtils.clamp(off.length(), controles.minDistance, controles.maxDistance);
  volarA(controles.target.clone().add(off.setLength(d)), controles.target.clone());
}
function girar(a) {
  const off = camera.position.clone().sub(controles.target).applyAxisAngle(EJE_Y, a);
  volarA(controles.target.clone().add(off), controles.target.clone());
}
// Doble clic: volar hacia ese punto
canvas.addEventListener('dblclick', (ev) => {
  if (!libre) return;
  ray.setFromCamera(aNDC(ev), camera);
  const h = ray.intersectObjects(scene.children, true)[0];
  if (!h) return;
  const off = camera.position.clone().sub(controles.target);
  off.setLength(Math.min(Math.max(off.length() * 0.5, 10), 40));
  volarA(h.point.clone().add(off), h.point.clone());
});
// Teclado: WASD / flechas para caminar, Q/E para girar, R/F (o +/-) para acercar/alejar
const teclas = new Set();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && libre) return alternarLibre(false);
  if (libre) { teclas.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); return; }
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); irA(Math.min(Math.round(tActual) + 1, N - 1)); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); irA(Math.max(Math.round(tActual) - 1, 0)); }
});
addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());
const adelante = new THREE.Vector3(), lado = new THREE.Vector3(), mov = new THREE.Vector3();
function moverConTeclado(dt) {
  if (!teclas.size) return;
  vuelo.activo = false;
  const dist = camera.position.distanceTo(controles.target);
  const vel = THREE.MathUtils.clamp(dist * 0.9, 8, 120) * dt;
  camera.getWorldDirection(adelante); adelante.y = 0; adelante.normalize();
  lado.crossVectors(adelante, EJE_Y);
  mov.set(0, 0, 0);
  if (teclas.has('w') || teclas.has('arrowup')) mov.add(adelante);
  if (teclas.has('s') || teclas.has('arrowdown')) mov.sub(adelante);
  if (teclas.has('d') || teclas.has('arrowright')) mov.add(lado);
  if (teclas.has('a') || teclas.has('arrowleft')) mov.sub(lado);
  if (mov.lengthSq()) { mov.normalize().multiplyScalar(vel); camera.position.add(mov); controles.target.add(mov); }
  const giro = (teclas.has('e') ? 1 : 0) - (teclas.has('q') ? 1 : 0);
  if (giro) {
    const off = camera.position.clone().sub(controles.target).applyAxisAngle(EJE_Y, -giro * dt * 1.4);
    camera.position.copy(controles.target).add(off);
  }
  const zoom = (teclas.has('r') || teclas.has('+') || teclas.has('=') ? 1 : 0) - (teclas.has('f') || teclas.has('-') ? 1 : 0);
  if (zoom) {
    const off = camera.position.clone().sub(controles.target);
    const d = THREE.MathUtils.clamp(off.length() * (1 - zoom * dt * 1.5), controles.minDistance, controles.maxDistance);
    camera.position.copy(controles.target).add(off.setLength(d));
  }
}
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
    moverConTeclado(dt);
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  calcularEncuadre();
  onScroll();
});

// Atajo para presentar / depurar: recorrido.saltar(n) va directo a la parada n
window.recorrido = {
  saltar(i) { scrollTo({ top: i * alturaSeccion(), behavior: 'instant' }); tObjetivo = tActual = i; },
  libre: alternarLibre,
  juegos, scene, THREE,
  volarA: (c, m) => volarA(v3(c), v3(m)),
};
