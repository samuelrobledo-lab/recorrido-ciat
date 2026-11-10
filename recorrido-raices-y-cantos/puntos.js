// ============================================================================
//  ESTACIONES DEL RECORRIDO  —  edita aquí los textos y las vistas de cámara
// ============================================================================
//  · Coordenadas en METROS, en el mismo sistema de Blender (X = este, Y = norte,
//    Z = altura). Puedes copiarlas del panel N abriendo "Propuesta_Unificada.blend".
//  · camara: dónde está la cámara.   mira: hacia dónde mira (y dónde va el pin).
//  · num: número de estación que se muestra (vacío en la intro y el cierre).
//  · marcador (opcional): dónde va el marcador en la exploración libre, si no es 'mira'.
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
    texto: 'La propuesta nace con la intención de crear un recorrido y nodo que invite a la pausa y al descanso, ofreciendo una experiencia accesible para todo público. A través de herramientas intuitivas, señalética interactiva y espacios contemplativos, el proyecto busca que cualquier visitante se encuentre con la belleza de las aves sin necesidad de contar con conocimientos previos.',
    datos: [['Estaciones', '10']],
    camara: [95, -95, 80], mira: [-5, -25, 0], sinPin: true,
  },
  {
    id: 'senal-norte', num: 1, tipo: 'senaletica',
    titulo: 'Señalética de recorrido',
    texto: 'Define la ubicación estratégica de mapas ilustrados en puntos de decisión del sendero. Incorpora una flecha calada que proyecta su sombra con la luz solar para orientar el camino sobre el suelo.',
    datos: [['Elemento', 'Mapa ilustrado con flecha calada']],
    camara: [35.8, 58.7, 1.75], mira: [30.4, 57.0, 1.1],
  },
  {
    id: 'juegos', num: 2, tipo: 'juegos',
    titulo: 'Primera parada interactiva',
    texto: 'Estructura de tres columnas con prismas giratorios que contienen información y piezas de aves divididas. Permite a los visitantes interactuar girando los módulos para armar las imágenes y descubrir los nombres de las especies.',
    datos: [['Módulos', '3 columnas de prismas giratorios']],
    camara: [38.6, 13, 1.6], mira: [31.6, 13, 1.25],
    encuadre: 0,   // 0 = centrado; 1 = corrido al lado contrario del recuadro (solo en pantallas anchas)
    interactivo: 'juegos',
  },
  {
    id: 'portal', num: 3, tipo: 'senaletica',
    titulo: 'Arco de entrada',
    texto: 'Elemento arquitectónico formado por dos árboles estilizados con ramas entrelazadas. Sostiene el símbolo de “Raíces y Cantos” y representa la transición física y visual al bosque.',
    datos: [['Elemento', 'Dos árboles estilizados']],
    camara: [40.2, -31.1, 2.3], mira: [32.3, -31.2, 2.0],
    encuadre: 0,
  },
  {
    id: 'caseta-kit', num: 4, tipo: 'casetas',
    titulo: 'Módulo de entrega',
    texto: 'Punto donde se entrega la Guía de aves a los visitantes para iniciar el recorrido. Diseñado en madera con techo a dos aguas y base con patrón de ramas, integrando la estética general.',
    datos: [['Material', 'Madera'], ['Entrega', 'Guía de aves']],
    camara: [21.6, -29.8, 1.9], mira: [21.6, -23.6, 1.55],
    encuadre: 0,
  },
  {
    id: 'guia-aves', num: 5, tipo: 'casetas',
    titulo: 'Guía de aves (Kit de avistamiento)',
    texto: 'Recurso bilingüe en formato carta horizontal con 9 fichas ilustradas sobre aves diurnas y nocturnas. Incluye información taxonómica, descripciones y espacio interactivo para dibujar y comentar.',
    datos: [['Formato', 'Carta horizontal'], ['Fichas', '9 aves diurnas y nocturnas'], ['Idiomas', 'Español e inglés']],
    camara: [21.5, -25.9, 2.6], mira: [21.5, -24.1, 1.0],
    marcador: [23.4, -24.6, 0.4],   // al lado del de la estación 4 (están en la misma caseta)
    encuadre: 0.8,
  },
  {
    id: 'deck-5', num: 6, tipo: 'arquitectura',
    titulo: 'Corazón de la estación',
    texto: 'Espacio de descanso ubicado bajo la sombra de los árboles, diseñado para proteger el suelo y las raíces. Cuenta con zona de binoculares, área para contemplar el dosel y un punto de agua para la atracción de aves.',
    datos: [['Deck', '1 de 3']],
    camara: [-27.1, -35.3, 4.5], mira: [-21.6, -25.8, 1.0],
    encuadre: 0,
  },
  {
    id: 'deck-6', num: 7, tipo: 'arquitectura',
    titulo: 'Corazón de la estación',
    texto: 'Espacio de descanso ubicado bajo la sombra de los árboles, diseñado para proteger el suelo y las raíces. Cuenta con zona de binoculares, área para contemplar el dosel y un punto de agua para la atracción de aves.',
    datos: [['Deck', '2 de 3']],
    camara: [-46.6, -46.6, 4.5], mira: [-57.6, -46.6, 1.0],
    encuadre: 0,
  },
  {
    id: 'deck-7', num: 8, tipo: 'arquitectura',
    titulo: 'Corazón de la estación',
    texto: 'Espacio de descanso ubicado bajo la sombra de los árboles, diseñado para proteger el suelo y las raíces. Cuenta con zona de binoculares, área para contemplar el dosel y un punto de agua para la atracción de aves.',
    datos: [['Deck', '3 de 3']],
    camara: [-27.1, -57.9, 4.5], mira: [-21.6, -67.4, 1.0],
    encuadre: 0,
  },
  {
    id: 'caseta-pasaporte', num: 9, tipo: 'casetas',
    titulo: 'Módulo de salida',
    texto: 'Estructura gemela al módulo del kit de avistamiento que sirve de contraparte al inicio. Delimita el cierre y final de la experiencia junto con la estación de “Pasaporte”, parte de la propuesta de la estación anterior.',
    datos: [['Función', 'Cierre de la experiencia']],
    camara: [16.1, -31.4, 1.9], mira: [16.1, -37.5, 1.55],
    encuadre: 0,
  },
  {
    id: 'senal-sur', num: 10, tipo: 'senaletica',
    titulo: 'Señalética de recorrido',
    texto: 'Define la ubicación estratégica de mapas ilustrados en puntos de decisión del sendero. Incorpora una flecha calada que proyecta su sombra con la luz solar para orientar el camino sobre el suelo.',
    datos: [['Elemento', 'Mapa ilustrado con flecha calada']],
    camara: [34.9, -70.0, 1.6], mira: [39.8, -71.2, 1.1],
    encuadre: 0,
  },
  {
    id: 'cierre', num: '', tipo: 'contexto',
    titulo: 'Una experiencia completa',
    texto: 'En conclusión, la propuesta busca democratizar la experiencia de observación de aves mediante herramientas accesibles y espacios interactivos, logrando que cualquier visitante pueda conectar de forma directa con la naturaleza sin requerir conocimientos previos.',
    datos: [['Arquitectura', 'Dylan Álvarez'], ['Diseño', 'Laura Rotavista, Samuel Robledo, Samuel Marmolejo, Daniel Correa']],
    camara: [-75, -140, 90], mira: [-5, -25, 0], sinPin: true,
  },
];
