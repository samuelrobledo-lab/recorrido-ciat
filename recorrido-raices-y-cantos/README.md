# Recorrido Raíces y Cantos · CIAT

Experiencia 3D interactiva de la propuesta arquitectónica y de diseño: un recorrido por scroll con 9 estaciones
(señalética, juegos interactivos, casetas y decks de observación) y un modo de exploración libre.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub y sube **todo el contenido de esta carpeta** (incluido `.nojekyll`).
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**,
   elige la rama `main` y la carpeta `/ (root)`, y guarda.
3. En un minuto queda publicado en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

## Verla en tu computador
El modelo 3D no carga abriendo `index.html` con doble clic (el navegador lo bloquea). Desde esta carpeta:
```
python3 -m http.server 8000
```
y abre http://localhost:8000

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Página base |
| `puntos.js` | **Textos de las estaciones** y posición de cámara de cada una (edita aquí la información) |
| `app.js` | Escena 3D, recorrido por scroll, modo libre, luces |
| `personas.js` | Personas low-poly, quienes caminan y sus rutas |
| `estilos.css` | Estilos (tipografía Source Sans 3) |
| `modelos/escena.glb` | Modelo unificado (escena de diseño + decks de arquitectura) |
| `modelos/personas.json` | Posiciones de las personas en decks y casetas |

Las librerías (three.js, Draco, Google Fonts) se cargan desde CDN, así que no hay que instalar nada.
