# Forja · App de entrenamiento de fuerza y calistenia

Aplicación web instalable (PWA) para iPhone: se añade a la pantalla de inicio desde Safari, se abre a pantalla completa, funciona sin conexión y guarda todo en el propio dispositivo. También funciona en ordenador y tablet.

## Instalarla en tu iPhone (sin Mac)

La app necesita estar publicada en una dirección `https://`. La forma gratuita más sencilla es **GitHub Pages**, y se puede hacer entera desde el iPhone:

1. Descomprime `forja.zip` en la app **Archivos** (tócalo y se descomprime solo).
2. En Safari, crea una cuenta en github.com (gratis) y pulsa **New repository**. Nombre: `forja`, tipo **Public**. Créalo.
3. En el repositorio, pulsa **Add file → Upload files**, elige todos los archivos de la carpeta `forja` (están todos en la raíz, sin subcarpetas) y pulsa **Commit changes**.
4. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`. Guarda. En uno o dos minutos aparecerá la dirección, del tipo `https://TU-USUARIO.github.io/forja/`.
5. Abre esa dirección en **Safari**, toca **Compartir → Añadir a pantalla de inicio**.

A partir de ahí ábrela siempre desde el icono de Forja. Los datos se guardan dentro de la app instalada (no los comparte con Safari).

**Actualizar a una versión nueva:** sube los archivos nuevos al repositorio (sustituyendo los anteriores). Cambia antes el valor `CACHE` de `sw.js` (por ejemplo `forja-v1.0.1`) para que el iPhone descargue la versión nueva; se aplica al cerrar y volver a abrir la app.

## Qué incluye esta primera versión

Ciclo completo funcional: elegir ejercicios → crear rutina → ejecutarla → registrar series → guardar la sesión → consultar historial, récords y gráficas.

| Fase | Contenido |
|---|---|
| 1. Arquitectura | Modelo de datos separado (abajo), lógica pura en `model.js` con pruebas, persistencia en IndexedDB |
| 2. Biblioteca | 424 ejercicios en 5 categorías (pesos libres, máquinas, calistenia, bandas/funcional, movilidad/core/acondicionamiento). Ficha con nombre ES/EN/alternativos, músculos, equipamiento, tipo, dificultad, instrucciones, errores, consejos y variantes más fáciles/difíciles. Búsqueda sin acentos y filtros por categoría, grupo, músculo, equipamiento, dificultad y tipo de movimiento. Favoritos y ejercicios personalizados con foto |
| 3. Rutinas | Ilimitadas. Nombre, descripción, días de la semana, arrastrar para reordenar, duplicar, sustituir, eliminar, superseries/biseries/triseries/circuitos/bloques, series de calentamiento, descendentes, al fallo, técnicas (pausa, parciales, excéntrica, tempo, rest-pause), objetivo por serie (rangos de reps, peso, segundos, RPE/RIR), notas, descanso, agarre, plantillas sugeridas |
| 4. Entrenamiento | Registro rápido (si dejas un campo vacío y pulsas ✓, se usa el objetivo o lo de la sesión anterior), columna «Anterior» que se copia con un toque, temporizador automático (pausar, ±15 s, reiniciar, saltar, cambiar duración), sonido, añadir/eliminar series y ejercicios sobre la marcha, saltar, reordenar, sustituir, terminar antes. Sobrevive a cierres y recargas. Pantalla siempre encendida |
| 5. Historial y estadísticas | Calendario, filtros por fechas/rutina/ejercicio/grupo, detalle y edición de sesiones, comparación entre sesiones, récords separados (fuerza, lastre, asistencia, repeticiones, duración, volumen), 1RM estimado, gráficas por ejercicio, volumen y frecuencia semanal, series y volumen por grupo muscular, nivel alcanzado en progresiones de calistenia |
| 6. Progresión y datos | Progresión doble opcional por ejercicio con sugerencias que nunca se aplican solas y se pueden desactivar. Perfil (edad, peso, objetivos, nivel, días, equipamiento), kg/lb, segundos o min:seg, modo claro/oscuro. Copia de seguridad JSON, restauración, CSV del historial, importar/exportar rutinas, borrado total con doble confirmación |

### Calistenia
Cada serie de un ejercicio de peso corporal tiene un botón de modo: **PC** (peso corporal), **+** (lastre) o **−** (asistencia con máquina o banda). La asistencia nunca se suma a la carga: con tu peso corporal indicado, la carga total es PC + lastre o PC − asistencia; sin él, solo cuenta el lastre. Los ejercicios isométricos y habilidades se registran en segundos. Hay cadenas de progresión (dominadas, flexiones, fondos, pistol, L-sit, planche, front lever, back lever, pino…) y la ficha muestra qué niveles has conseguido.

## Arquitectura

```
index.html            Contenedor y metadatos de app iOS
app.css               Estilos (tema claro/oscuro con variables)
app.js                Vistas y controladores (sin frameworks)
ui.js                 Iconos, diálogos, gráficas SVG, sonido, arrastrar y soltar, archivos
model.js              Lógica pura: carga, volumen, 1RM, récords, progresión, estadísticas, CSV, validación
exercises.js          Biblioteca de ejercicios, patrones de movimiento, cadenas de progresión, plantillas sugeridas
store.js              Persistencia en IndexedDB (respaldo en localStorage)
sw.js                 Service worker: funcionamiento sin conexión
manifest.webmanifest  Manifiesto de la app instalable
model.test.mjs        Pruebas automáticas (node --test)
```

Sin dependencias externas ni servidor: todo se ejecuta en el dispositivo.

## Modelo de datos

Los pesos se guardan siempre en kilogramos y los tiempos en segundos; la conversión a libras o min:seg es solo de presentación.

- **Ejercicio (biblioteca)** `{id, name, nameEn, alt[], category, equipment[], primary, secondary[], pattern, mechanic, laterality, load: weight|bodyweight|band|none, measure: reps|time, difficulty, tags[], easier[], harder[], tip}`. Los personalizados añaden `custom:true`, `steps[]`, `mistakes[]`, `image`.
- **Plantilla (rutina)** `{id, name, description, days[], groups[{id,type}], items[]}`
  - **Ejercicio de plantilla** `{uid, exerciseId, groupId, restSec, grip, notes, progression{mode,repMin,repMax,increment}, sets[]}`
  - **Serie planificada** `{type: normal|warmup|drop|failure, tech, reps, repsMax, weight, seconds, rpe, rir, mode, band}`
- **Sesión ejecutada** `{id, templateId, templateName, startedAt, endedAt, bodyweight, notes, prs[], exercises[]}`
  - **Ejercicio de sesión** — copia (snapshot) de nombre, músculos, tipo de carga y medida en el momento de entrenar, más `groupId, restSec, grip, notes, sets[]`
  - **Serie realizada** `{type, tech, target{...objetivo planificado}, weight, reps, seconds, mode, band, rpe, rir, done, doneAt}`
- **Historial y estadísticas** se calculan a partir de las sesiones; no se guardan aparte, así que siempre son coherentes.

Como cada sesión guarda su propia copia, **modificar o borrar una rutina o un ejercicio personalizado nunca altera los entrenamientos ya registrados**.

## Ampliar la biblioteca

Añade una fila a `ROWS` en `exercises.js`:

```js
['id_unico', 'Nombre', 'English name', 'Alias|Otro alias', 'cal', 'barra_dominadas', 'espalda', 'biceps,antebrazo', 'v_pull', 'C bw 2'],
```

Banderas: `C`/`I` compuesto o aislamiento · `U` unilateral · `w`/`bw`/`band`/`none` tipo de carga · `t` por tiempo · `1`/`2`/`3` dificultad · `iso`/`ecc`/`plyo`. Opcionalmente añade un consejo en `TIPS` o una cadena en `CHAINS`. No hay que tocar nada más. Las instrucciones y errores se toman del patrón de movimiento; puedes darles texto propio con `steps`/`mistakes`.

## Pruebas

```
node --test
```

18 pruebas de la lógica: integridad de la biblioteca, búsqueda, unidades, 1RM, carga con lastre/asistencia, volumen, récords, snapshot de sesiones, progresión doble, series por grupo muscular, programación semanal, validaciones, CSV, superseries y duplicado de rutinas. Además se ha probado de extremo a extremo en un navegador con tamaño de iPhone: crear rutina, entrenar, recargar a mitad, terminar, historial, estadísticas, exportar/importar y restaurar copia.

## Limitaciones en iPhone y alternativas

- **Vibración:** Safari en iOS no permite que una web vibre. Alternativa: aviso sonoro y destello en pantalla al terminar el descanso.
- **Sonido:** no suena con el interruptor de silencio activado.
- **Aviso con la app en segundo plano o con la pantalla bloqueada:** iOS congela las webs en segundo plano y las notificaciones locales necesitarían un servidor de notificaciones. El temporizador se basa en la hora real, así que al volver muestra el tiempo correcto. Alternativa: mantener la pantalla encendida durante la sesión (activado por defecto).
- **Sincronización entre dispositivos:** no hay servidor ni cuentas; los datos solo están en el dispositivo. Alternativa: exportar la copia de seguridad a iCloud Drive/Archivos e importarla en otro dispositivo. La app avisa en Inicio si llevas más de 14 días sin copia.
- **Imágenes/animaciones de los ejercicios:** la biblioteca no incluye imágenes con derechos de uso. Cada ficha muestra un pictograma del tipo de equipamiento, y en los ejercicios personalizados puedes añadir tu propia foto.
- **Borrado por iOS:** las apps añadidas a la pantalla de inicio no sufren el borrado automático de 7 días de Safari, pero si borras la app de la pantalla de inicio se borran sus datos. Haz copias.
