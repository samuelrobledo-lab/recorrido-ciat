// Personas low-poly a escala real (≈1,70 m adultos), en el mismo estilo gráfico de la escena.
// Las posiciones salen de modelos/personas.json (calculado en Blender con 4_posiciones_personas.py).
import * as THREE from 'three';

const PIEL = ['#8d5a3b', '#c68a5e', '#e2b48c', '#6b4430', '#a8714a'];
const ROPA = ['#c7653d', '#4f7d3c', '#d9a521', '#3f6e8c', '#e9e2cf', '#8c5b37', '#b5c936', '#4169d8'];
const PANTALON = ['#2f3b4a', '#5a4a3a', '#3d3d3d', '#6b6f78', '#2e4a3a'];
// Materiales y geometrías compartidos entre todas las personas (menos memoria y cambios de estado)
const MATS = new Map(), GEOS = new Map();
const mat = (c) => {
  if (!MATS.has(c)) MATS.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
  return MATS.get(c);
};
const geo = (clave, crear) => {
  if (!GEOS.has(clave)) GEOS.set(clave, crear());
  return GEOS.get(clave);
};
const cilindro = (r1, r2, h, lados) =>
  geo(`c${r1.toFixed(4)}|${r2.toFixed(4)}|${h.toFixed(4)}|${lados}`, () => new THREE.CylinderGeometry(r1, r2, h, lados));
const esfera = (r) => geo(`e${r.toFixed(4)}`, () => new THREE.IcosahedronGeometry(r, 0));
const pick = (arr, i) => arr[i % arr.length];

function miembro(radio, largo, material) {
  // cilindro con el pivote en el extremo superior (hombro / cadera)
  const g = new THREE.Group();
  const m = new THREE.Mesh(cilindro(radio, radio * 0.85, largo, 6), material);
  m.position.y = -largo / 2;
  g.add(m);
  return g;
}

export function crearPersona(tipo, semilla = 0, escala = 1) {
  const H = 1.72 * escala;
  const piel = mat(pick(PIEL, semilla * 3 + 1));
  const ropa = mat(pick(ROPA, semilla * 5 + 2));
  const pantalon = mat(pick(PANTALON, semilla * 7 + 3));
  const cuerpo = new THREE.Group();          // pivote en los pies, mirando hacia -Z

  const cadera = 0.47 * H;
  const piernas = [-1, 1].map((s) => {
    const p = miembro(0.055 * H, cadera, pantalon);
    p.position.set(s * 0.06 * H, cadera, 0);
    cuerpo.add(p);
    return p;
  });
  const torso = new THREE.Mesh(cilindro(0.105 * H, 0.085 * H, 0.33 * H, 7), ropa);
  torso.position.y = cadera + 0.165 * H;
  cuerpo.add(torso);
  const cabeza = new THREE.Mesh(esfera(0.068 * H), piel);
  cabeza.position.y = cadera + 0.33 * H + 0.09 * H;
  cuerpo.add(cabeza);
  const hombro = cadera + 0.3 * H;
  const brazos = [-1, 1].map((s) => {
    const b = miembro(0.032 * H, 0.36 * H, ropa);
    b.position.set(s * 0.125 * H, hombro, 0);
    b.rotation.z = s * 0.08;
    const mano = new THREE.Mesh(esfera(0.028 * H), piel);
    mano.position.y = -0.38 * H;
    b.add(mano);
    cuerpo.add(b);
    return b;
  });

  const persona = new THREE.Group();
  persona.add(cuerpo);
  persona.userData = { piernas, brazos, cuerpo, H };
  if (tipo === 'binoculares') {
    cuerpo.rotation.x = -0.12;                                   // inclinada hacia los binoculares
    brazos.forEach((b, i) => { b.rotation.x = 2.2; b.rotation.z = (i ? -1 : 1) * 0.35; });
  } else if (tipo === 'sentada') {
    piernas.forEach((p) => (p.rotation.x = Math.PI / 2));       // piernas estiradas hacia adelante
    brazos.forEach((b, i) => { b.rotation.x = -0.5; b.rotation.z = (i ? 1 : -1) * 0.25; });
    cuerpo.position.y = -cadera + 0.06 * H;
  } else if (tipo === 'acostada') {
    brazos.forEach((b, i) => { b.rotation.x = Math.PI * 0.9; b.rotation.z = (i ? -1 : 1) * 0.5; }); // manos tras la cabeza
    cuerpo.rotation.x = Math.PI / 2;                             // boca arriba, pies hacia donde "mira"
    cuerpo.position.y = 0.1 * H;
    cuerpo.position.z = -0.0;
  } else if (tipo === 'jugando') {
    // un brazo extendido girando un bloque del juego
    brazos[0].rotation.x = 1.35; brazos[1].rotation.x = 0.9; brazos[1].rotation.z = -0.3;
  } else if (tipo === 'abrazando') {
    // brazos al frente rodeando el tronco, cuerpo pegado al árbol
    brazos[0].rotation.set(1.45, 0, 0.55); brazos[1].rotation.set(1.45, 0, -0.55);
    cuerpo.rotation.x = -0.06;
    cabeza.rotation.y = 0.5;
  } else if (tipo === 'caminando') {
    // la pose se anima en animarPersonas()
  } else {
    // de pie: brazos levemente hacia el mostrador
    brazos.forEach((b) => (b.rotation.x = 0.35));
  }
  persona.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return persona;
}

// Blender (x, y, z) -> three; orienta a la persona hacia el punto "mira"
export function ubicarPersonas(scene, lista) {
  lista.forEach((p, i) => {
    const per = crearPersona(p.tipo, i, p.escala ?? (i % 4 === 3 ? 0.92 : 1));
    per.position.set(p.pos[0], p.z ?? 0, -p.pos[1]);
    const dx = p.mira[0] - p.pos[0], dz = -(p.mira[1] - p.pos[1]);
    per.rotation.y = Math.atan2(-dx, -dz);
    per.name = 'Persona_' + i;
    scene.add(per);
  });
}

// ---------------------------------------------------------------- Personas fijas extra
// Jugando en los juegos (estación 2) y leyendo los mapas (señales 1 y 9). Coordenadas Blender.
function abrazo(arbol, desde, escala = 1) {
  const dx = desde[0] - arbol[0], dy = desde[1] - arbol[1], L = Math.hypot(dx, dy);
  const d = 0.5 + 0.17 * escala;
  return [{ tipo: 'abrazando', pos: [arbol[0] + (dx / L) * d, arbol[1] + (dy / L) * d], mira: arbol, escala }];
}
export const PERSONAS_EXTRA = [
  // columnas del juego (ya a escala): Izq y=11.85 · Centro y=12.99 · Der y=14.13, frente hacia +x
  { tipo: 'jugando', pos: [32.35, 11.15], mira: [31.65, 11.85] },              // al lado de la columna izquierda
  { tipo: 'jugando', pos: [32.25, 13.56], mira: [31.6, 13.1], escala: 0.7 },   // niño entre centro y derecha
  { tipo: 'jugando', pos: [32.35, 14.85], mira: [31.6, 14.13], escala: 0.8 },  // al lado de la derecha
  { tipo: 'pie', pos: [33.7, 15.6], mira: [31.6, 13.0] },                      // acompañante mirando
  // abrazando árboles (samanes junto al sendero; tronco ≈0,48 m de radio)
  ...abrazo([-41.4, -38.4], [-33.6, -46.6]),
  ...abrazo([-41.4, -38.4], [-41.4, -30.0], 0.72),
  ...abrazo([-2.1, -46.7], [0.0, -43.0]),
  { tipo: 'pie', pos: [31.8, 56.6], mira: [30.4, 57.0] },                      // leyendo el mapa de llegada
  { tipo: 'pie', pos: [31.9, 57.7], mira: [30.4, 57.1], escala: 0.75 },
  { tipo: 'pie', pos: [38.4, -71.2], mira: [39.8, -71.3] },                    // leyendo el mapa de salida
];

// ---------------------------------------------------------------- Personas caminando
// Cada ruta es una polilínea en coordenadas Blender; las personas la recorren en bucle.
const FUENTE = [-33.6, -46.6];
const DECKS = [[-21.6, -25.8], [-57.6, -46.6], [-21.6, -67.4]];   // centros de los decks (estaciones 5, 6, 7)
const circulo = (r, n = 24) => Array.from({ length: n + 1 }, (_, k) => {
  const a = (k / n) * Math.PI * 2;
  return [FUENTE[0] + r * Math.cos(a), FUENTE[1] + r * Math.sin(a)];
});
// El sendero circular pasa por el centro de los decks: al llegar a cada uno, la gente lo
// bordea por dentro (del lado de la fuente) en un arco a RADIO_DECK del centro del deck.
const RADIO_SENDERO = 24, RADIO_DECK = 6.2;
const ANG_DECKS = DECKS.map(([x, y]) => Math.atan2(y - FUENTE[1], x - FUENTE[0]));
const circuloSendero = Array.from({ length: 241 }, (_, k) => {
  const a = (k / 240) * Math.PI * 2;
  let r = RADIO_SENDERO;
  for (const ad of ANG_DECKS) {
    const d = Math.atan2(Math.sin(a - ad), Math.cos(a - ad));
    const lateral = RADIO_SENDERO * Math.abs(Math.sin(d));
    if (Math.abs(d) < Math.PI / 2 && lateral < RADIO_DECK) {
      // punto del círculo alrededor del deck que queda hacia la fuente
      r = Math.min(r, RADIO_SENDERO * Math.cos(d) - Math.sqrt(RADIO_DECK ** 2 - lateral ** 2));
    }
  }
  return [FUENTE[0] + r * Math.cos(a), FUENTE[1] + r * Math.sin(a)];
});
const entrada = [[18.8, -30.6], [12.0, -33.6], [5.0, -38.6], [0.0, -43.0], [-9.6, -46.6]];
const RUTAS = [
  // Por el sendero hecho: entran desde las casetas, dan la vuelta por los 3 decks y salen
  { puntos: [...entrada, ...circuloSendero.slice(1), ...entrada.slice(0, -1).reverse()],
    personas: [{ fase: 0.1 }, { fase: 0.13, escala: 0.74 }, { fase: 0.45 }, { fase: 0.78 }], velocidad: 0.78 },
  // Por el sendero circular en sentido contrario
  { puntos: [...circuloSendero].reverse(), personas: [{ fase: 0.2 }, { fase: 0.62 }], velocidad: 0.72 },
  // Entrando: desde la señal de llegada (norte), por el borde de la vía, hasta el portal y las casetas
  { puntos: [[32.6, 59.5], [33.4, 50], [33.4, -27.5], [31.0, -31.1], [24.0, -30.8], [19.5, -30.6]],
    personas: [{ fase: 0.05 }, { fase: 0.32, escala: 0.75 }, { fase: 0.36 }, { fase: 0.71 }], velocidad: 0.91 },
  // Saliendo: desde las casetas, a través del portal, hacia la señal de salida (sur)
  { puntos: [[19.5, -31.4], [24.0, -31.6], [31.0, -31.6], [33.6, -35], [33.6, -66.5], [37.4, -70.4]],
    personas: [{ fase: 0.15 }, { fase: 0.55 }, { fase: 0.6, escala: 0.8 }], velocidad: 0.85 },
  // Paseando alrededor de la fuente
  { puntos: circulo(5.2), personas: [{ fase: 0 }, { fase: 0.04, escala: 0.74 }, { fase: 0.5 }], velocidad: 0.59 },
  { puntos: circulo(7.2).reverse(), personas: [{ fase: 0.25 }, { fase: 0.8 }], velocidad: 0.65 },
];

const caminantes = [];
export function crearCaminantes(scene) {
  let semilla = 40;
  for (const ruta of RUTAS) {
    const pts = ruta.puntos.map(([x, y]) => new THREE.Vector3(x, 0, -y));
    const largos = [0];
    for (let i = 1; i < pts.length; i++) largos.push(largos[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = largos[largos.length - 1];
    for (const p of ruta.personas) {
      const per = crearPersona('caminando', semilla++, p.escala ?? 1);
      per.userData.ruta = { pts, largos, total, s: p.fase * total, vel: ruta.velocidad * (p.escala ?? 1) ** 0.5 };
      per.userData.paso = Math.random() * 6;
      scene.add(per);
      caminantes.push(per);
    }
  }
}
const tmp = new THREE.Vector3();
export function animarPersonas(dt) {
  for (const per of caminantes) {
    const r = per.userData.ruta;
    r.s = (r.s + r.vel * dt) % r.total;
    let i = 1;
    while (i < r.largos.length - 1 && r.largos[i] < r.s) i++;
    const a = r.pts[i - 1], b = r.pts[i];
    const u = (r.s - r.largos[i - 1]) / (r.largos[i] - r.largos[i - 1]);
    per.position.lerpVectors(a, b, u);
    per.position.y = DECKS.some(([x, y]) => (per.position.x - x) ** 2 + (per.position.z + y) ** 2 < 16) ? 0.27 : 0;
    tmp.subVectors(b, a);
    const objetivo = Math.atan2(-tmp.x, -tmp.z);
    let d = objetivo - per.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    per.rotation.y += d * Math.min(1, dt * 6);       // gira suave en las esquinas
    // ciclo de caminata
    const { piernas, brazos, cuerpo, H } = per.userData;
    per.userData.paso += dt * r.vel * 5.2 / (H / 1.72);
    const w = Math.sin(per.userData.paso);
    piernas[0].rotation.x = w * 0.45; piernas[1].rotation.x = -w * 0.45;
    brazos[0].rotation.x = -w * 0.4; brazos[1].rotation.x = w * 0.4;
    cuerpo.position.y = Math.abs(Math.cos(per.userData.paso)) * 0.025 * H;
  }
}
