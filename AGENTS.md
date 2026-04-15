# AGENTS.md

## Contexto del proyecto

Este repositorio contiene una aplicación web para administrar en tiempo real un torneo de frontenis llamado **"Dual-Meet Atlas Chapalita - Ávila Camacho"**, programado para el **18 de marzo**. La aplicación fue diseñada para desplegarse en **Railway** usando **Node.js** y persistencia en **archivos locales JSON**, sin base de datos.

El objetivo principal es operar como una plataforma de control de torneo con dos modos:

1. **Modo público / solo lectura**: cualquier persona sin sesión puede ver la información, pero no modificar nada.
2. **Modo administrador**: usuarios autenticados con contraseña pueden registrar parejas, iniciar el torneo, reordenar parejas, capturar resultados, reiniciar el torneo y cerrar sesión.

La interfaz debe ser:

* **minimalista**,
* **moderna**,
* **sobria**,
* **monocromática**,
* con **fondo blanco** y **texto negro**,
* con tipografía **Saira** de Google Fonts,
* con **iconografía de Google** (Material Symbols / Material Icons),
* completamente **responsiva**,
* apta para **móviles**,
* con **animaciones discretas** de alta calidad visual.

---

## Stack y restricciones

### Stack requerido

* **Node.js** en backend.
* UI moderna en frontend.
* **Socket.IO** o mecanismo equivalente de tiempo real para actualización instantánea.
* Persistencia en **archivos JSON** locales.
* Despliegue objetivo: **Railway**.

### Restricciones fuertes

* **No usar base de datos**.
* **No usar almacenamiento externo** salvo archivos locales del proyecto.
* **No permitir edición** a usuarios no autenticados.
* **No asumir autenticación por defecto**; el acceso de edición debe depender de sesión válida.
* **No romper compatibilidad con Railway**; el servidor debe escuchar en `process.env.PORT`.
* Mantener una arquitectura simple y fácil de mantener.

---

## Identidad funcional del sistema

La aplicación debe actuar como un **sistema de control de torneo** con las siguientes capacidades:

* Registro de parejas por equipo:

    * **Atlas Chapalita**
    * **Ávila Camacho**
* Agrupación de parejas en dos grupos / canchas al iniciar el torneo.
* Generación de cuadro principal con partidos entre todas las parejas del grupo.
* Reparto equilibrado de cargas para reducir repeticiones inmediatas y favorecer descanso.
* Captura de resultados por partido.
* Cálculo automático de standings por grupo.
* Clasificación a semifinales.
* Final entre ganadores de semifinal.
* Campeón final sin partido por tercer lugar.
* Actualización de cuadro y tablas en tiempo real.

---

## Flujo general de la aplicación

### 1) Antes de iniciar el torneo

La página debe mostrar primero el **registro de parejas**.

Debe existir un listado persistido de parejas separadas por equipo, con al menos:

* nombre de la pareja,
* equipo al que pertenece,
* estado (registrada / participante / eliminada / clasificada, si aplica).

En esta fase la UI debe priorizar el registro y visualización de parejas.

### 2) Al iniciar el torneo

Cuando un usuario autenticado presiona **"Iniciar Torneo"**, el sistema debe:

* dividir las parejas en **2 grupos/canchas**,
* distribuirlas de manera equilibrada entre **Atlas Chapalita** y **Ávila Camacho**,
* generar los partidos del round robin dentro de cada grupo,
* organizar la secuencia de partidos para minimizar que una pareja juegue inmediatamente después de otro partido muy similar y mejorar descansos,
* inicializar el cuadro principal.

### 3) Durante el torneo

La pantalla principal debe mostrar:

* un **cuadro/bracket grande** en la parte superior,
* debajo, los **partidos por grupo** que faltan por jugar o que ya fueron jugados,
* al fondo, dos **tablas de standings**, una por grupo.

Los resultados se actualizan en tiempo real conforme se capturan.

### 4) Al terminar la fase de grupos

Se seleccionan las **2 mejores parejas de cada grupo** por este orden de desempate:

1. **Partidos ganados**.
2. **Diferencia de puntos** (puntos ganados - puntos perdidos).
3. **Resultado directo entre ellas** si persiste el empate.

Luego se generan:

* **2 semifinales**:

    * 1.º de Grupo 1 vs 2.º de Grupo 2
    * 1.º de Grupo 2 vs 2.º de Grupo 1
* **1 final** entre los ganadores de semifinal.

No existe partido por tercer lugar.

---

## Reglas del torneo que el código debe respetar

### Fase de grupos

* Cada pareja juega contra todas las demás de su grupo.
* Cada grupo funciona como una cancha.
* Los partidos se juegan a **10 puntos con fuera**.
* En el cuadro principal solo debe mostrarse el **marcador final**.
* El sistema debe ordenar y reasignar partidos procurando una distribución razonable del descanso.

### Captura de resultados

Cuando se captura un resultado manualmente:

* el operador selecciona el **ganador**,
* introduce el puntaje del perdedor,
* el ganador se asume con **11 puntos** si el formato del torneo lo implica por el “10 y fuera”

    * o se registra conforme la mecánica interna definida en el proyecto.

Antes de guardar debe existir una **ventana de confirmación** con una previsualización de:

* partido seleccionado,
* ganador,
* puntaje ingresado,
* impacto en el cuadro/tabla.

### Reordenamiento de parejas

Debe existir un botón **"Re-ordenar parejas"** disponible solo para administradores autenticados.
Este botón debe:

* mezclar nuevamente las parejas,
* mantener la lógica de distribución por equipo,
* respetar la intención de balancear los grupos,
* incorporar aleatoriedad controlada para evitar sesgos repetitivos.

### Reset

Debe existir un botón **"Reset"** disponible solo para administradores autenticados.
El reset debe:

* borrar el estado del torneo,
* limpiar resultados,
* limpiar grupos y cuadro,
* restaurar el sistema a estado inicial,
* mantener o limpiar el registro de parejas según la implementación definida; por defecto, el reset debe ser **completo** salvo que se indique lo contrario.

---

## Reglas de autenticación y permisos

### Público sin sesión

* Solo visualización.
* No puede registrar parejas.
* No puede iniciar torneo.
* No puede reordenar parejas.
* No puede capturar resultados.
* No puede resetear.
* No puede hacer logout porque no tiene sesión activa.

### Usuario autenticado

* Puede registrar parejas.
* Puede iniciar torneo.
* Puede reordenar parejas.
* Puede capturar resultados.
* Puede ver opciones administrativas.
* Puede hacer logout.
* Puede hacer reset.

### Sesión

* La autenticación debe ser por **contraseña**.
* La sesión puede ser por **cookie** o sesión en servidor.
* La sesión debe persistir durante la navegación normal.
* La contraseña administrativa no debe estar hardcodeada en el frontend.
* Debe cargarse desde variable de entorno.

Variables esperadas:

* `ADMIN_PASSWORD`
* `SESSION_SECRET`
* `NODE_ENV`
* `PORT` (provisto por Railway)

---

## Persistencia

### Filosofía

El proyecto no debe depender de base de datos. Toda persistencia debe resolverse con archivos JSON locales, idealmente dentro de una carpeta de datos como:

* `data/`
* `storage/`
* o equivalente.

### Estado a persistir

Guardar al menos:

* parejas registradas,
* agrupación actual,
* fixture de partidos,
* resultados capturados,
* standings calculados,
* estado del torneo,
* configuración mínima del torneo,
* semilla o estado de reordenamiento si aplica,
* metadatos de sesión o usuarios si se requieren para auditoría local.

### Recomendación técnica

Usar escritura atómica de archivos cuando sea posible:

* escribir archivo temporal,
* renombrar sobre el original,
* evitar corrupción si el proceso se interrumpe.

---

## Estructura funcional sugerida del dominio

El modelo interno debería poder representar al menos las siguientes entidades.

### `Team`

* `id`
* `name` (`Atlas Chapalita` o `Ávila Camacho`)

### `Pair`

* `id`
* `teamId`
* `players` o `name`
* `createdAt`
* `status`

### `Group`

* `id`
* `name` (`Grupo 1`, `Grupo 2`)
* `assignedPairs[]`

### `Match`

* `id`
* `groupId`
* `round`
* `pairAId`
* `pairBId`
* `winnerPairId`
* `loserPoints`
* `winnerPoints`
* `status` (`pending`, `in_progress`, `completed`)
* `playedAt`
* `nextMatchLinks` o referencias para bracket

### `TournamentState`

* `status` (`registration`, `group_stage`, `semifinals`, `final`, `finished`)
* `groups[]`
* `matches[]`
* `semifinals[]`
* `finalMatchId`
* `championPairId`
* `updatedAt`

### `StandingRow`

* `pairId`
* `matchesPlayed`
* `matchesWon`
* `pointsFor`
* `pointsAgainst`
* `difference`
* `headToHead` si aplica

---

## UI / UX requirements

### Visual style

* Blanco dominante.
* Texto negro o gris carbón.
* Bordes muy sutiles.
* Espaciado amplio.
* Jerarquía visual clara.
* Tarjetas discretas, limpias, sin ruido visual.
* Animaciones suaves, no exageradas.
* Comportamiento profesional tipo dashboard premium.

### Tipografía

* Usar **Saira** desde Google Fonts.
* Aplicar consistencia tipográfica:

    * títulos grandes,
    * subtítulos medianos,
    * texto funcional legible.

### Iconografía

* Usar Material Symbols / Google Icons.
* Iconos mínimos pero útiles:

    * login,
    * logout,
    * reset,
    * lock,
    * add,
    * play,
    * trophy,
    * scoreboard,
    * swap/reorder,
    * save.

### Layout de la pantalla principal

La pantalla debe ordenar el contenido en este orden:

1. **Header**

    * nombre del torneo,
    * estado actual,
    * acciones de login / logout / reset / iniciar torneo / reordenar.

2. **Registro de parejas** si el torneo no ha iniciado.

3. **Cuadro principal** si el torneo ya inició.

    * Debe verse grande y dominante.
    * Debe representar semifinales y final con flujos visuales claros.
    * Debe permitir actualización visual en tiempo real.

4. **Partidos por grupo**

    * debajo del cuadro,
    * mostrar partidos pendientes y jugados,
    * con resultado en tiempo real.

5. **Standings**

    * dos tablas,
    * una pestaña o sección por grupo:

        * `Grupo 1`
        * `Grupo 2`
    * columnas:

        * Pareja
        * Partidos Jugados
        * Partidos Ganados
        * Puntos Ganados
        * Puntos Perdidos
        * Diferencia
    * ordenar en tiempo real.
    * resaltar las **2 primeras parejas**.
    * resaltar un poco más la primera posición.
    * incluir una guía explicativa al final.

### Responsive behavior

En móvil:

* las secciones deben apilarse verticalmente,
* el bracket debe ser navegable sin romperse,
* tablas deben poder desplazarse horizontalmente o transformarse en tarjetas compactas,
* acciones administrativas deben seguir accesibles pero compactadas,
* el login y las acciones del torneo deben permanecer visibles o fácilmente accesibles.

---

## Tiempo real

El proyecto requiere actualización inmediata entre clientes. La estrategia recomendada es:

* backend autoritativo,
* frontend suscrito a eventos en vivo,
* socket para difundir:

    * nuevas parejas,
    * cambios de agrupación,
    * inicio de torneo,
    * resultados guardados,
    * actualización de standings,
    * cambio de fase,
    * reset.

Eventos útiles:

* `pairs:updated`
* `tournament:started`
* `match:updated`
* `standings:updated`
* `bracket:updated`
* `tournament:reset`
* `auth:changed`

---

## Comportamiento esperado del cuadro / bracket

El cuadro no debe ser una imagen estática; debe ser un componente interactivo o semidinamico que pueda:

* mostrar llaves,
* mostrar avance de cada partido,
* reflejar ganador que avanza,
* conectar semifinales con final,
* actualizar visualmente al guardar resultados.

El bracket debe soportar:

* transición entre fases,
* highlight del partido activo o recién actualizado,
* representación clara de semifinales y final.

---

## Criterios de emparejamiento y distribución

### Objetivo

Distribuir parejas de ambos equipos en dos grupos de forma lo más equilibrada posible.

### Recomendación

Al iniciar o reordenar:

* alternar o balancear Atlas y Ávila Camacho,
* evitar que un grupo reciba demasiadas parejas de un solo equipo,
* mantener aleatoriedad suficiente para que no se repitan patrones obvios.

### Descanso entre partidos

Durante la secuencia de encuentros de grupo, priorizar:

* no repetir a una pareja en partidos demasiado cercanos,
* evitar que una misma pareja aparezca consecutivamente si hay otra alternativa válida,
* distribuir el orden de los juegos para que el descanso sea razonable.

No es necesario implementar una optimización compleja; basta con una heurística sólida y predecible.

---

## Páginas / vistas funcionales esperadas

Aunque el proyecto puede ser una SPA o una aplicación server-rendered con progresivo enriquecimiento, funcionalmente debe incluir:

### Vista principal pública

* visualización del estado actual del torneo,
* registro visible de parejas,
* bracket en caso de torneo iniciado,
* standings,
* partidos por grupo.

### Vista / modal de login

* acceso mediante contraseña,
* habilitación de acciones administrativas.

### Vista / modal de captura de resultado

* lista o selector del partido,
* selección del ganador,
* captura del puntaje del perdedor,
* confirmación previa,
* guardar resultado.

### Acciones de administración

* iniciar torneo,
* reordenar parejas,
* reset,
* logout.

---

## Criterios de calidad del código

### Necesidades de ingeniería

* Código legible.
* Separación razonable entre frontend, backend y lógica de torneo.
* Funciones puras para cálculos de standings y desempates cuando sea posible.
* Validación de entrada en servidor y cliente.
* Manejo de errores explícito.
* No asumir datos bien formados.
* No depender de estado global frágil sin persistencia.

### Seguridad mínima

* No exponer secretos en frontend.
* No confiar en el navegador para validar permisos.
* Validar sesión en backend para rutas o acciones administrativas.
* Evitar que usuarios sin sesión puedan invocar mutaciones por endpoint directo.

---

## Despliegue en Railway

### Requisitos

* El servidor debe escuchar en `process.env.PORT`.
* Debe existir un `package.json` con scripts funcionales.
* Debe ser compatible con despliegue desde GitHub.
* Variables de entorno deben configurarse en Railway.

### Variables de entorno mínimas

* `PORT` — provista por Railway.
* `SESSION_SECRET` — cadena aleatoria larga.
* `ADMIN_PASSWORD` — contraseña administrativa.
* `NODE_ENV=production`.

### Comportamiento esperado en producción

* Inicio correcto sin pasos manuales extra.
* Los archivos JSON deben persistir en el filesystem disponible por Railway según la configuración del servicio.
* El aplicativo debe iniciar aun si no hay parejas cargadas todavía.

---

## Convenciones recomendadas para futuros agentes

### Qué priorizar

1. Mantener la lógica del torneo correcta.
2. Mantener el control de acceso por sesión.
3. No perder la persistencia en archivos.
4. Conservar la estética monocromática y profesional.
5. Dar prioridad a la experiencia móvil.
6. Evitar complejidad innecesaria.

### Qué no hacer

* No introducir base de datos salvo que el usuario lo pida explícitamente.
* No degradar el diseño a algo demasiado visualmente cargado.
* No agregar colores arbitrarios fuera de una paleta sobria.
* No reemplazar Saira por otra tipografía sin autorización.
* No eliminar el panel de resultados en tiempo real.
* No simplificar el cuadro hasta volverlo una lista plana.

### Qué revisar antes de cambiar algo importante

* Si un cambio afecta el flujo del torneo.
* Si cambia el significado de los desempates.
* Si cambia la persistencia.
* Si afecta la disponibilidad pública/privada.
* Si rompe Railway.

---

## Resumen operativo breve

Este proyecto es una aplicación de control de torneo de frontenis con:

* registro de parejas por equipo,
* acceso administrativo por contraseña,
* persistencia en JSON,
* bracket interactivo,
* tabla de resultados por grupo,
* semifinales y final,
* tiempo real,
* UI monocromática y premium,
* despliegue en Railway.

Cualquier cambio futuro debe respetar ese núcleo funcional y visual.
