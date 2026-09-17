# Changelog

Todos los cambios relevantes de la aplicación de Recursos Humanos (`rrhh-pwa`).

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado según [Versionado Semántico](https://semver.org/lang/es/).

---

## [2.14.0] — 2026-09-17

### Cambiado

- **Un rol de turnos ya guardado solo lo puede modificar quien lo creó**
  (SPEC-022). Cualquiera puede abrirlo y verlo; guardarlo, únicamente su autor.
  Un administrador también puede, para que el rol no quede congelado si el
  autor sale de la empresa.
- Los departamentos asignados siguen decidiendo quién puede **crear** roles.
  Eso no cambió.

### Agregado

- **El número de faltas de cada rol**, a la izquierda del icono de Excel. En
  cero se muestra igual, en gris.

### Notas

Tres supervisores comparten impresión. Con esta regla, si el autor del rol
falta, sus compañeros de área ya no pueden ajustarlo y hay que pedírselo a un
administrador. Era la razón por la que SPEC-013 había puesto el permiso por
departamento; se revierte a petición expresa.

Las faltas de todos los roles se cuentan con una sola lectura de asistencias,
limitada a los días ya transcurridos. Si esa lectura falla no se muestra
número, porque sin asistencias todo turno terminado parecería falta.

---

## [2.13.0] — 2026-09-17

### Agregado

- **Promociones internas** (SPEC-021):
  - El colaborador se busca **escribiendo nombre o nómina**, con sugerencias, en
    vez de elegirlo de una lista de más de cien personas.
  - El **puesto destino** es ahora una lista: con «cambio de puesto» trae todos
    los puestos del padrón; con «nueva categoría», la escala A, B, C y D.
  - **Semáforo en las fechas de evaluación**: rojo si el corte ya pasó sin
    calificar, ámbar si faltan tres días o menos.
  - Al marcar una evaluación como **rechazada**, se pregunta si el caso termina
    ahí o si se le dan **tres meses más**. La ronda anterior se archiva y la
    tarjeta muestra que va en su segundo periodo.

### Notas

No se puede abrir una evaluación para un nombre tecleado que no exista: el
campo obligatorio se satisface con la nómina elegida, no con lo escrito.

El semáforo solo alarma mientras la evaluación sigue en proceso. Una
calificación de cero cuenta como calificada, porque es una nota real.

Dar tres meses más no borra nada: las calificaciones de la ronda que termina se
guardan como periodo anterior.

---

## [2.12.0] — 2026-09-16

### Agregado

- **Fecha en el registro de incidencias** (SPEC-020). Viene con la de hoy
  puesta y se puede mover, porque una incidencia se registra a veces días
  después de ocurrida. Sale también en el historial y en las exportaciones.
- **Los puestos se eligen de una lista acotada al departamento**, en el
  Directorio y al abrir una vacante. La lista sale del propio padrón, así que
  se mantiene sola conforme cambia la plantilla. Hay una opción «Otro puesto»
  para plazas que nunca han existido.
- **El departamento de una vacante se elige de la lista cerrada**, ya no se
  escribe libre.

### Cambiado

- En el registro individual del Directorio, **departamento y puesto
  intercambiaron lugar**: el departamento va primero porque de él dependen los
  puestos elegibles.

### Quitado

- **La carga masiva del padrón desde archivo Excel**, junto con su vista previa
  y su motor de lectura.

### Notas

El alta y la corrección de colaboradores queda de uno en uno. La exportación
del directorio a Excel y PDF no se tocó.

Las incidencias registradas antes de esta versión no traen fecha y aparecen con
un guion, en lugar de mostrar una inventada.

---

## [2.11.1] — 2026-09-16

### Cambiado

- **Las gráficas ahora solo las ve quien tenga permiso** (SPEC-019). Los
  administradores las ven siempre; para los demás hay una casilla nueva,
  **«Puede ver las gráficas»**, en la pantalla de Permisos dentro de Sucesos y
  Turnos.

### Notas

El permiso vive en el padrón, no en el código, igual que los de turnos, reporte
de faltas y promociones. Cuando se contrate a alguien más de Recursos Humanos,
basta con marcarle la casilla: no hay que tocar código ni volver a compilar.

La condición está escrita una sola vez, en `services/permisosPadron.ts`. Las
gráficas salen en tres pestañas y, repitiendo la regla tres veces, tarde o
temprano una se habría quedado atrás.

Sigue siendo un candado de interfaz, como los demás de esta aplicación: quien
tenga conocimientos puede leer los datos de todos modos, porque las reglas de
Firestore no distinguen usuarios (SPEC-008).

---

## [2.11.0] — 2026-09-16

### Agregado

- **Gráficas** (SPEC-018), cada una debajo de su sección:
  - **Antigüedad de la plantilla**, bajo Aniversarios: cuánta gente hay en cada
    tramo de años, sobre el padrón activo completo.
  - **Rotación de los últimos 12 meses**, bajo Cumpleaños: altas contra bajas,
    mes a mes.
  - **Plazas por departamento**, bajo Abrir nueva vacante: requeridas contra
    cubiertas, con el total pendiente.
  - **Incidencias por tipo y por departamento**, bajo el Historial.
  - **Faltas por día y por departamento**, bajo la Bitácora de sucesos, con
    selector de periodo y botón para calcular.
- **Fecha de baja** en el padrón, que escribe el cambio de estatus del
  Directorio. Es lo que permite medir la rotación.

### Notas

Las gráficas se dibujan a mano en SVG, sin librería. Agregar una dependencia
obligaría a regenerar `package-lock.json`, que no se puede hacer desde el
teléfono, y la compilación fallaría.

La barra de bajas empieza vacía. Las bajas se empezaron a fechar con esta
versión; las anteriores no traen fecha y quedan fuera, y la gráfica lo dice en
lugar de aparentar que no hubo ninguna. Las altas sí tienen historia completa,
porque salen de la fecha de ingreso.

La gráfica de faltas no se calcula sola al abrir la pestaña: hay que leer las
revisiones de EPP de cada persona y cada día del periodo, y hacerlo en cada
visita gastaría cuota de Firestore sin que nadie lo pida.

---

## [2.10.0] — 2026-09-16

### Agregado

- **Cumpleaños del mes** en la pestaña de Antigüedad y Vacantes (SPEC-017), en
  su propia tarjeta debajo de los aniversarios. Ordenados por día, con el de
  hoy resaltado, los ya pasados atenuados, la edad que cumple cada quien y
  salida a Excel.
- **Las fechas de nacimiento vienen cargadas y se siembran solas.** La base de
  Recursos Humanos quedó en `src/data/cumpleanos.ts`; al abrir la pestaña, la
  app escribe en el padrón las fechas de quien todavía no tiene ninguna. No hay
  que subir ningún archivo. Solo rellena huecos: nunca pisa una fecha ya
  capturada, para que una corrección hecha a mano no se deshaga sola.
- **Columna `Cumpleaños`** en la plantilla registrada del Directorio, a la
  derecha de `Ingreso`, y también en sus exportaciones a Excel y PDF.
- Campo de **fecha de nacimiento** en el registro individual del directorio —
  el mismo formulario sirve para el alta y para la edición—, y columna
  `NACIMIENTO` opcional en la importación y en la exportación.
- El aviso de fechas faltantes **lista los nombres**, no solo el total: con un
  número suelto no se sabía a quién había que editar.

### Corregido

- **Los aniversarios se calculaban con un día de desfase.** `new Date('2020-09-01')`
  devuelve la medianoche UTC, que en México cae el 31 de agosto, así que quien
  entró el día 1 de un mes nunca aparecía en su mes de aniversario y quien
  entró el día 1 del mes siguiente aparecía de más. Ahora las fechas se parten
  a mano y ya no dependen de la zona horaria.

### Notas

La carga de cumpleaños escribe **solo** la fecha de nacimiento y va por su
propio camino, no por la importación del directorio. Esa base trae nómina y
fecha, sin departamento: en la importación normal todas las filas se
rechazarían, y las que sí trajeran departamento habrían vaciado el puesto y la
fecha de ingreso de esa gente.

Tampoco da de alta a nadie. Una nómina que no esté en el directorio se reporta
y se omite.

---

## [2.9.2] — 2026-09-14

### Cambiado

- **La pestaña de Cursos ya no abre con el padrón completo desplegado.** Al
  entrar se ven solo los filtros y los botones; la tabla aparece al pulsar el
  botón nuevo **Filtrar**. Sin ningún filtro puesto, Filtrar muestra a todo el
  personal, que es la salida deliberada para ver el listado completo.
- Se agrega un botón **Limpiar**, que borra los filtros y vuelve a ocultar la
  tabla.
- Excel y PDF quedan deshabilitados mientras no se haya filtrado: antes
  habrían generado un archivo vacío.

### Notas

Los filtros que se van capturando ya no afectan la tabla al momento: se aplican
solo al pulsar Filtrar. Es lo que permite revisar varias combinaciones sin que
la tabla se recalcule con cada tecla.

---

## [2.9.1] — 2026-09-14

### Agregado

- **Un alta nueva en el directorio abre sola su evaluación de contrato de
  planta**, con el periodo arrancando en la fecha de ingreso. Aplica al registro
  individual, no a la importación desde Excel, y solo a altas: editar a alguien
  que ya existe no abre nada.

### Notas

Si el colaborador se captura sin fecha de ingreso, la evaluación no se abre
—sin esa fecha no hay de dónde calcular los tres cortes mensuales— y el mensaje
de guardado lo dice para que se capture y se abra a mano.

Si la apertura falla por cualquier otro motivo, el colaborador queda registrado
igual y el aviso aparece en el mismo mensaje: el alta es lo prioritario, pero
un fallo callado dejaría a alguien sin su evaluación sin que nadie lo supiera.

Tampoco se puede abrir a mano un segundo contrato de planta para quien ya tiene
uno. Las promociones de categoría y de puesto sí pueden repetirse.

---

## [2.9.0] — 2026-09-14

### Agregado

- **Promociones internas (SPEC-016)**, nueva sección en la pestaña de
  Capacitación, debajo de la matriz. Registra evaluaciones para contrato de
  planta, nueva categoría en el mismo puesto o cambio de puesto: periodo de tres
  meses, una calificación mensual de 0 a 100, promedio automático y estatus en
  proceso / aprobada / rechazada. Se exporta a Excel.
- **Casilla «Puede capturar promociones internas»** en la pantalla de Permisos.
  Es para Recursos Humanos, que necesita llevar estas evaluaciones sin por eso
  ser administrador del padrón ni de los roles de turnos.

### Cambiado

- **Control de Antigüedad ahora muestra solo a quienes cumplen aniversario en el
  mes en curso**, no al padrón completo. La tabla es para actuar sobre ellos, y
  entre cientos de renglones la docena que importaba se perdía.
- **Se quitan las tarjetas «Total de Incidencias» y «Días de Suspensión
  Acumulados»** de la pestaña de Incidencias.

---

## [2.8.1] — 2026-09-14

### Cambiado

- **Los tres botones de la cabecera del rol de turnos son ahora circulares y
  solo con icono**: permisos, nuevo y faltas, los tres del mismo tamaño. El
  «Nuevo» queda relleno en azul y los otros dos con contorno, para que siga
  leyéndose cuál es la acción principal.
- Al quedarse sin texto, cada uno lleva `title` y `aria-label`: son lo único que
  dice qué hacen, tanto al pasar el cursor como para un lector de pantalla.

---

## [2.8.0] — 2026-09-14

### Agregado

- **Reporte de faltas (SPEC-015).** Botón «Faltas» junto a «Nuevo», en el rol de
  turnos. Abre una ventana donde se elige periodo y departamento y devuelve la
  lista de faltas, con descarga a Excel y PDF. Una falta es donde hubo turno
  asignado, el turno ya terminó y no hubo revisión de EPP.
- **Opción «Todos los departamentos»**, para sacar el reporte de toda la planta
  de una sola vez. La ven los administradores y quien tenga marcada la casilla
  nueva en la pantalla de Permisos: es para Recursos Humanos, que necesita el
  reporte completo sin por eso poder programar roles.

### Cambiado

- **La columna de nombres del rol de turnos ya no corta los nombres largos.**
  Se ensanchó y ahora parte en dos renglones cuando hace falta.

---

## [2.7.1] — 2026-09-14

### Corregido

- **La falta ya no se afirma antes de que termine el turno.** La versión 2.7.0
  miraba solo la fecha, así que alguien de `T2` —que entra a las 14:00—
  aparecía como «No asistió» desde la madrugada, antes de que empezara su
  jornada. Ahora la celda no dice nada hasta que pasó la hora de salida.
- **Se contemplan los turnos que cruzan la medianoche.** Un `T3` o un `N12` del
  día 14 terminan a las 06:00 del 15 y hasta entonces no se juzgan. En `LIB` se
  usan las horas capturadas a mano.
- El «Asistió» sigue apareciendo en cuanto se hace la revisión, sin esperar:
  solo se hace esperar al dato que puede equivocarse.

### Cambiado

- **El indicador ahora es solo un icono dentro de la celda del turno**, pegado a
  la derecha: palomita verde si asistió, cruz roja si no. Antes era texto debajo
  del turno, que en un rol mensual no cabía.
- La cuadrícula se refresca sola cada minuto, para que una celda cambie de
  estado al terminar el turno aunque la pantalla lleve rato abierta.
- La exportación a Excel sigue la misma regla: un turno en curso sale sin marca.

---

## [2.7.0] — 2026-09-14

### Agregado

- **La asistencia llega desde EPP (SPEC-014).** Cada celda del rol de turnos
  con turno asignado muestra **Asistió** o **No asistió** según haya habido o no
  una revisión de EPP de esa persona ese día. La exportación a Excel incluye lo
  mismo.
- El dato viaja por la colección `asistencia` del proyecto de la suite, que EPP
  escribe al guardar cada inspección. RRHH solo lee.

### Notas

Solo se evalúan celdas **con turno asignado** y fechas **que ya ocurrieron**: un
descanso no es una falta y un rol de la próxima semana no puede tener a nadie
ausente. La asistencia no se puede marcar a mano; si se pudiera, dejaría de ser
lo que la revisión constató.

Requiere la regla de la colección `asistencia` en el proyecto de la suite. Sin
ella, EPP avisará en cada revisión y RRHH no marcará a nadie.

---

## [2.6.0] — 2026-09-14

### Agregado

- **Candados en el rol de turnos (SPEC-013).** Crear y editar roles deja de
  estar abierto a todos: cada persona puede tener asignados los departamentos
  que le toca programar, y quien no tenga ninguno solo consulta y exporta. El
  administrador puede programar todos sin aparecer en ninguna lista.
- **Pantalla «Permisos»**, dentro de Sucesos y Turnos y visible solo para
  `ADMIN`: lista al personal activo, con los departamentos como botones que se
  marcan y desmarcan. Se guarda al instante, sin botón de confirmar. Aparecen
  primero quienes ya tienen algún permiso, y hay buscador.

### Cambiado

- **El permiso ahora es por departamento, no por autoría.** Antes solo quien
  creaba un rol —o un administrador— podía editarlo. Ahora puede hacerlo
  cualquiera con ese departamento asignado, lo haya creado o no: es lo que hace
  falta cuando varios supervisores cubren la misma línea o alguien falta.
- El selector de departamento al crear un rol solo ofrece los permitidos.

### Notas

El campo `departamentosTurnos` vive en el padrón, y a propósito **no** forma
parte de los campos que escribe la importación de Excel: si lo fuera, un archivo
sin esa columna borraría todos los permisos en cada carga. Sobrevive también a
la edición normal de un colaborador y a un cambio de número de nómina.

---

## [2.5.0] — 2026-09-13

### Cambiado

- **Encabezado alineado con el resto de la suite**, tomando como referencia el
  de Control de Proceso: marca y nombre de la aplicación centrados, debajo el
  nombre y el puesto de quien entró, y a la derecha el número de nómina en un
  círculo azul junto al botón circular de cerrar sesión. El punto verde y el
  «En línea» se conservan, ahora debajo de ese botón.
- **La sesión ahora incluye el puesto**, que antes no traía. Se lee del mismo
  documento del padrón que ya se consultaba al entrar, así que no agrega
  ninguna lectura extra. Si el padrón no tiene puesto para esa persona, se
  muestra su papel en la aplicación en lugar de dejar el renglón vacío.

---

## [2.4.0] — 2026-09-13

### Agregado

- **Pestaña «Sucesos y Turnos», abierta a todos.** Es la excepción deliberada
  al bloqueo de la v2.3: aquí capturan igual administradores y no
  administradores, porque quien levanta un reporte de piso o arma un rol es
  quien está en el turno (SPEC-012).
- **Bitácora de sucesos.** Se reporta fecha, colaborador y tipo —no se presentó
  a laborar, abandonó el turno, llegada tarde, cambio de turno, accidente,
  otro— con descripción opcional. Cada registro guarda quién lo reportó. Se
  filtra y se exporta a Excel y PDF. Borrar un suceso queda reservado a
  `ADMIN`.
- **Rol de turnos**, réplica del módulo de la aplicación de Mantenimiento:
  cuadrícula de personas contra días, mismo catálogo (`T1`, `T2`, `T3`, `D12`,
  `N12`, `G8`, `LIB`), periodos semanal, quincenal y mensual, copiar y pegar
  turnos —por celda o fila completa—, limpiar fila, domingos resaltados y
  exportación a Excel. El departamento se elige al crear el rol y determina qué
  personas salen en la cuadrícula.

### Notas

Un suceso **no** es una incidencia: no afecta nómina, suspensiones ni el
historial de incidencias. Son bitácoras distintas a propósito.

Cualquiera crea un rol de turnos, pero editarlo o borrarlo solo puede hacerlo
quien lo creó o un administrador; los demás lo abren en modo lectura. Esa
restricción vive en la interfaz, no en las reglas de Firestore, por la misma
razón explicada en la v2.3.

---

## [2.3.0] — 2026-09-13

### Cambiado

- **Solo los administradores pueden capturar.** En incidencias, capacitación
  y vacantes desaparecen los formularios de alta, los botones de eliminar y
  la edición en línea para todo el que no sea `ADMIN`. En su lugar aparece un
  aviso de que está viendo la información en modo consulta.
- **Consultar, filtrar y exportar siguen abiertos para todos.** Las tablas,
  los buscadores, la paginación y las descargas a Excel y PDF no cambian: son
  lectura y no modifican nada.
- **El papel `CAPTURA` queda sin efecto dentro de esta aplicación.** Hasta la
  v2.2 podía alimentar incidencias, cursos y vacantes; ahora se comporta igual
  que `CONSULTA`. El papel sigue existiendo en el padrón y en las otras
  aplicaciones de la suite, que no se tocan.

### Notas

Este cambio es de interfaz. Lo que impide de verdad una escritura son las
reglas de Firestore, que viven en la consola de Firebase y no en este
repositorio: hay que actualizarlas también, o alguien con el papel
`CAPTURA` seguirá pudiendo escribir por fuera de la aplicación.

---

## [2.2.2] — 2026-09-13

### Cambiado

- **Se quita el pie de página de la aplicación.** Con él se va también la
  línea separadora que lo encabezaba, que solo existía para ese texto. El pie
  era único y compartido por todas las pestañas, así que desaparece en todas.

---

## [2.2.1] — 2026-09-13

### Corregido

- **Una incidencia sin suspensión no se guardaba.** El formulario se limpiaba
  como si hubiera funcionado, pero el registro nunca llegaba al historial. La
  causa: la versión 2.2.0 mandaba `diasSuspension` con valor `undefined`
  cuando la casilla de suspensión no estaba marcada, y Firestore rechaza el
  documento completo si encuentra un campo así. Ahora ese campo solo se
  incluye cuando hay suspensión.
- **Un fallo al guardar ya no pasa desapercibido.** Antes el formulario se
  limpiaba sin esperar la respuesta de Firestore, así que cualquier error
  quedaba invisible. Ahora se espera el guardado, el formulario solo se
  limpia si el registro quedó guardado de verdad, y si algo falla se avisa en
  pantalla. El botón muestra «Guardando…» y queda deshabilitado mientras
  tanto, lo que de paso evita registros duplicados por doble toque.

---

## [2.2.0] — 2026-09-12

### Cambiado

- **Registro de incidencias: fuera fecha inicio/fecha fin, entran
  observaciones y una suspensión explícita.** El formulario ya no pide un
  rango de fechas genérico. En su lugar hay un campo de observaciones libres
  y una casilla **Suspensión**: al marcarla, primero pregunta el número de
  días y después abre un calendario para elegir esos días exactos, uno por
  uno (SPEC-011).
- **El historial de incidencias cambia de columnas.** Sale Periodo, Días y
  Estatus; entra Suspensión (las fechas elegidas, si las hay) y Observaciones.
  Excel y PDF exportan las mismas columnas nuevas.
- **El estatus de aprobación se retira.** Solo tomaba el valor `APROBADO` y
  ningún flujo lo cambiaba; no era información real.
- El indicador «Días Totales Ausentados» del resumen pasa a llamarse **Días
  de Suspensión Acumulados** y solo cuenta días de suspensiones reales, no
  todas las incidencias por igual.

### Notas

Los registros anteriores a esta versión no tienen `observaciones` ni
`suspension`: se siguen mostrando, con esas columnas en blanco. La consulta ya
no ordena por `fechaInicio` en Firestore —ese campo desaparece— sino que trae
todo y ordena por `createdAt` en el cliente, precisamente para no dejar fuera
en silencio ningún registro viejo que no tuviera ese campo.

---

## [2.1.0] — 2026-09-05

### Cambiado

- **El directorio de personal pasa a leer y escribir en `impredimex-suite`.**
  Con esto RRHH queda como la única aplicación que escribe el padrón del que
  dependen los inicios de sesión de las cinco apps, y las reglas publicadas
  anoche —que exigen `ADMIN` en `roles.rrhh`— empiezan a proteger algo que la
  aplicación sí usa.
- Los módulos de incidencias, capacitación, cursos y vacantes **no se movieron**:
  siguen en el proyecto `rrhh-pwa`, que es donde están sus datos reales.

### Notas

La migración que anticipaba la SPEC-009 no hizo falta. El proyecto propio de
RRHH tenía tres colaboradores de prueba, no un padrón paralelo; los 121 de la
suite se habían cargado directo desde Excel. Verificado que esas tres nóminas ya
existían en la suite con sus datos correctos, el cambio se redujo al origen de
la base de datos.

Quedan tres documentos huérfanos en `rrhh-pwa/colaboradores`. Conviene
eliminarlos a mano para no dejar dos listas con el mismo nombre.

---

## [2.0.0] — 2026-09-05

Primera etapa de la integración con la suite Impredimex: control de acceso.

Hasta esta versión la aplicación no tenía ninguno. Cualquiera con la dirección
entraba y editaba el padrón de personal, que es la lista de la que dependen los
inicios de sesión de las cinco aplicaciones de la suite, y el repositorio es
público.

### Agregado

- Pantalla de acceso con nómina y clave contra Firebase Auth del proyecto
  `impredimex-suite` (SPEC-001). La sesión sobrevive al recargar y al cerrar el
  navegador, y se cierra con el botón Salir del encabezado.
- Tres papeles leídos de `roles.rrhh`: `ADMIN`, `CAPTURA` y `CONSULTA`
  (SPEC-002). La ausencia de papel equivale a `CONSULTA`, el más bajo.
- Contexto de sesión (`SesionContext`) para que cada módulo consulte el papel
  sin recibirlo por props.
- Catálogo cerrado de los 13 departamentos y función de normalización de
  nombres, en `utils/catalogos.ts`.
- Cálculo de antigüedad al vuelo desde `fechaIngreso`, para no guardarla.
- `SPECS.md` y este `CHANGELOG.md`, que la regla 7 de la suite exige y que la
  aplicación no tenía.
- Vista previa antes de importar desde Excel (SPEC-006): cuántas altas, cuántas
  actualizaciones, qué filas se rechazan y por qué, y la lista nominal de quién
  está dado de baja en el archivo, con una casilla para decidir si se reactiva.
- Botón de dar de baja y reactivar en la tabla. Hasta ahora el único modo de
  cambiar el estatus era importando un Excel.
- Confirmación al eliminar (SPEC-005), que nombra a la persona y advierte que
  pierde el acceso a todas las aplicaciones de la suite.
- `nombreNormalizado` se recalcula en cada guardado, con el mismo criterio que
  usa la colección de la suite: palabras del nombre en orden alfabético.
- Cada escritura del padrón deja `actualizadoEn` y `actualizadoPor` con la
  nómina de quien la hizo, usando los nombres de campo que la colección de la
  suite ya tenía.

### Cambiado

- **Los botones de alta, edición, importación, baja y borrado solo existen para
  `ADMIN`.** Los demás papeles ven el directorio en modo consulta, con un aviso
  que lo explica.
- **El departamento se elige de una lista de 13 valores**, ya no se escribe. En
  la importación, las filas con un departamento fuera del catálogo se rechazan
  y se listan con su motivo, en vez de guardarse mal. Un «FLEXOGRAFIA» sin
  acento deja a esa gente sin equipo asignado en EPP y falla en silencio.
- **La escritura del padrón usa una lista blanca de campos.** Antes se guardaba
  con `...colaborador` y los permisos sobrevivían solo porque la escritura usaba
  `merge`; el día que alguien quitara esa opción se llevaba `apps` y `roles` de
  las 121 personas.
- La importación ya no fuerza `ACTIVO`: si no se pide reactivar, el documento
  conserva el estatus que tenía.

### Corregido

- `tsc` ahora corre sin errores. Faltaba `vite-env.d.ts` con los tipos de Vite,
  y `main.tsx` importaba `./App.tsx` con extensión, que ese `tsconfig` no
  permite. Como el script de compilación no ejecuta `tsc`, nadie se enteraba.

### Notas

- **El padrón sigue escribiéndose en el proyecto propio de RRHH.** El cambio al
  proyecto de la suite espera a la migración de datos de la SPEC-009. Apuntar a
  la suite antes de migrar haría que la aplicación editara una copia vieja
  mientras los datos reales se quedan atrás.
- **`CAPTURA` queda definido pero sin asignar.** Se usará cuando se agregue la
  sección donde los quince perfiles de consulta capturen información.
- **`CONSULTA` ve las incidencias de toda la planta y puede exportarlas.**
  Decidido a conciencia; queda documentado en la SPEC-002.

### Pendiente antes de publicar

Ninguna de las quince cuentas tiene todavía `rrhh` en su campo `apps`, así que
al publicar esta versión nadie podrá entrar. Hay que agregarlo documento por
documento en la consola de Firebase, sobre `colaboradores` del proyecto suite,
junto con `roles.rrhh` en `ADMIN` para Víctor Moreno García y Maritza Galván
Rivas, y `CONSULTA` para las trece restantes.

---

## [1.x] — anterior a este archivo

Versión sin control de acceso, con el padrón en el proyecto propio y sin
documentación de especificaciones.
