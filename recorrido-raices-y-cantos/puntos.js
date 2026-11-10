// ============================================================================
//  ESTACIONES DEL RECORRIDO  —  edita aquí los textos y las vistas de cámara
// ============================================================================
//  · Coordenadas en METROS, en el mismo sistema de Blender (X = este, Y = norte,
//    Z = altura). Puedes copiarlas del panel N abriendo "Propuesta_Unificada.blend".
//  · camara: dónde está la cámara.   mira: hacia dónde mira (y dónde va el pin).
//  · num: número de estación que se muestra (vacío en la intro y el cierre).
//  · tipo: color del recuadro → 'arquitectura' | 'senaletica' | 'casetas' |
//          'juegos' | 'contexto'
//  · Los textos entre [corchetes] son de relleno: reemplázalos por la info real.
//  · Si un árbol o edificio queda entre la cámara y la estación, se vuelve
//    transparente solo, así que no tienes que esquivarlo a mano.
// ============================================================================

export const PROYECTO = {
  titulo: 'Recorrido Raíces y Cantos',
  subtitulo: 'Propuesta arquitectónica y de diseño · CIAT',
};

export const PUNTOS = [
  {
    id: 'intro', num: '', tipo: 'contexto',
    titulo: 'El recorrido',
    texto: '[Introducción de la propuesta: qué es, para quién es y qué busca. 2–3 líneas.]',
    datos: [['Estaciones', '9'], ['Longitud del recorrido', '[m]']],
    camara: [95, -95, 80], mira: [-5, -25, 0], sinPin: true,
  },
  {
    id: 'senal-norte', num: 1, tipo: 'senaletica',
    titulo: 'Señal de llegada',
    texto: '[Señal Raíces y Cantos en el acceso norte: orientación y mapa del recorrido.]',
    datos: [['Tipo', '[direccional / informativa]']],
    camara: [35.8, 58.7, 1.75], mira: [30.4, 57.0, 1.1],
  },
  {
    id: 'juegos', num: 2, tipo: 'juegos',
    titulo: 'Juegos interactivos',
    texto: '[Cómo funciona el juego y qué aprende quien lo usa.] Toca los bloques para girarlos.',
    datos: [['Público', '[edades]']],
    camara: [38.6, 13, 1.6], mira: [31.6, 13, 1.25],
    encuadre: 0,   // 0 = centrado; 1 = corrido al lado contrario del recuadro (solo en pantallas anchas)
    interactivo: 'juegos',
  },
  {
    id: 'portal', num: 3, tipo: 'senaletica',
    titulo: 'Portal de bienvenida',
    texto: '[Descripción del portal Raíces y Cantos: concepto, materiales y mensaje.]',
    datos: [['Diseño', '[equipo de diseño]'], ['Material', '[WPC / madera]']],
    camara: [40.2, -31.1, 2.3], mira: [32.3, -31.2, 2.0],
    encuadre: 0,
  },
  {
    id: 'caseta-kit', num: 4, tipo: 'casetas',
    titulo: 'Caseta del kit',
    texto: '[Qué recibe el visitante aquí: kit de avistamiento, folletos de la guía de aves…]',
    datos: [['Entrega', '[contenido del kit]']],
    camara: [21.6, -29.8, 1.9], mira: [21.6, -23.6, 1.55],
    encuadre: 0,
  },
  {
    id: 'deck-5', num: 5, tipo: 'arquitectura',
    titulo: 'Deck de observación 1',
    texto: '[Qué se observa desde aquí, capacidad, pérgola y binoculares.]',
    datos: [['Capacidad', '[personas]'], ['Altura pérgola', '[m]']],
    camara: [-27.1, -35.3, 4.5], mira: [-21.6, -25.8, 1.0],
    encuadre: 0,
  },
  {
    id: 'deck-6', num: 6, tipo: 'arquitectura',
    titulo: 'Deck de observación 2',
    texto: '[Qué se observa desde aquí, capacidad, pérgola y binoculares.]',
    datos: [['Capacidad', '[personas]']],
    camara: [-46.6, -46.6, 4.5], mira: [-57.6, -46.6, 1.0],
    encuadre: 0,
  },
  {
    id: 'deck-7', num: 7, tipo: 'arquitectura',
    titulo: 'Deck de observación 3',
    texto: '[Qué se observa desde aquí, capacidad, pérgola y binoculares.]',
    datos: [['Capacidad', '[personas]']],
    camara: [-27.1, -57.9, 4.5], mira: [-21.6, -67.4, 1.0],
    encuadre: 0,
  },
  {
    id: 'caseta-pasaporte', num: 8, tipo: 'casetas',
    titulo: 'Caseta del pasaporte',
    texto: '[Cómo funciona el pasaporte: sellos de cada estación, premio o certificado al terminar…]',
    datos: [['Entrega', '[pasaporte / sello]']],
    camara: [16.1, -31.4, 1.9], mira: [16.1, -37.5, 1.55],
    encuadre: 0,
  },
  {
    id: 'senal-sur', num: 9, tipo: 'senaletica',
    titulo: 'Señal de salida',
    texto: '[Señal Raíces y Cantos en el extremo sur: cierre del recorrido y mapa.]',
    datos: [['Tipo', '[direccional / informativa]']],
    camara: [34.9, -70.0, 1.6], mira: [39.8, -71.2, 1.1],
    encuadre: 0,
  },
  {
    id: 'cierre', num: '', tipo: 'contexto',
    titulo: 'Una experiencia completa',
    texto: '[Cierre: impacto esperado, siguientes pasos, créditos del equipo.]',
    datos: [['Arquitectura', '[nombre]'], ['Diseño', '[nombres]']],
    camara: [-75, -140, 90], mira: [-5, -25, 0], sinPin: true,
  },
];
