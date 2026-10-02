# Profesor Nativo

Profesor particular de idiomas que empieza desde cero, con un plan de 90 días y una pista de inglés para la industria audiovisual. Empieza por el inglés y está preparado para añadir otros idiomas.

Es una web instalable (PWA) que funciona en iPhone, Android y ordenador. No tiene servidor ni servicios de pago:

- El contenido (lecciones, ejercicios, pruebas) son archivos dentro de `content/<idioma>/`.
- La voz usa la síntesis y el reconocimiento de voz del propio navegador.
- El progreso se guarda solo en el dispositivo, con copia de seguridad descargable.

## Estructura

| Ruta | Qué contiene |
| --- | --- |
| `index.html`, `manifest.webmanifest`, `sw.js` | Página, datos de instalación y funcionamiento sin conexión |
| `js/app.js` | Pantallas: configuración, inicio, prueba, resultado y ajustes |
| `js/placement.js` | Prueba de nivel por bloques (A1, A2, B1) y parte oral |
| `js/speech.js` | Escuchar y hablar con la voz del dispositivo |
| `js/store.js` | Perfil y resultados guardados en el dispositivo |
| `content/en/placement.json` | Preguntas de la prueba de nivel de inglés |

## Probar en local

```sh
python3 -m http.server 8000
```

Y abrir http://localhost:8000.

## Publicar

Se publica con GitHub Pages desde la rama `main`. Al cambiar archivos, sube `VERSION` en `sw.js` para que los dispositivos instalados descarguen la versión nueva.
