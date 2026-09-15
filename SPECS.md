# SPECS.md — Recursos Humanos (rrhh-pwa)

## Especificaciones funcionales del sistema

Este documento es la **fuente de verdad** del comportamiento de la aplicación.
Cualquier cambio futuro debe partir de actualizar primero estas specs y luego
implementar el código.

**Versión objetivo:** 2.0
**Fecha:** 5 de septiembre de 2026
**Metodología:** Spec-Driven Development (SDD)

> **Nota de origen.** La aplicación se construyó antes de que existiera la suite
> y hasta hoy no tiene ningún control de acceso. Estas son sus primeras specs:
> los módulos de incidencias, capacitación, cursos y vacantes se documentan aquí
> a grandes rasgos, tal como están implementados, y se detallarán conforme se
> toquen.

---

## Convenciones del documento

Cada spec sigue esta estructura:

- **Actor** — Quién ejecuta el flujo
- **Precondiciones** — Qué debe cumplirse antes de iniciar
- **Flujo principal** — Pasos exactos del comportamiento esperado
- **Postcondiciones** — Estado del sistema al terminar correctamente
- **Reglas de negocio** — Condiciones especiales y restricciones
- **Flujos alternativos** — Casos de error o rutas opcionales

---

# SPEC-001 — Acceso a la aplicación

**Estado:** implementado

### Actor
Personal autorizado de Recursos Humanos.

### Precondiciones
- La persona existe en la colección `colaboradores` del proyecto
  **impredimex-suite**
- Su campo `estatus` es `ACTIVO`
- Su campo `apps` incluye el valor `rrhh`
- Tiene cuenta en Firebase Auth del proyecto suite, con identificador
  `<noNomina>@impredimex.local`
- Conexión a internet

### Flujo principal
1. Sistema muestra la pantalla de acceso con dos campos: número de nómina y clave
2. Usuario escribe su nómina y su clave de 6 dígitos
3. Sistema arma el identificador `<nómina>@impredimex.local`
4. Sistema invoca `signInWithEmailAndPassword` contra Auth del proyecto suite
5. Sistema lee el documento `colaboradores/<nómina>`
6. Sistema valida que `estatus` sea `ACTIVO` y que `apps` incluya `rrhh`
7. Sistema toma el papel de `roles.rrhh`
8. Sistema muestra la aplicación con los módulos que ese papel permite

### Postcondiciones
- Existe una sesión activa con nómina, nombre y papel
- La sesión sobrevive al recargar y al cerrar el navegador
- Salir es un acto explícito

### Reglas de negocio
- **Nunca hay contraseñas ni PIN en el código.** El dominio
  `@impredimex.local` no existe de verdad: solo forma un identificador único.
  Firebase no envía correos ni lo verifica.
- **Tener cuenta no da acceso.** Lo da estar en `apps`. Una persona con cuenta
  para EPP no entra aquí salvo que se le agregue `rrhh`.
- **Ausencia de papel equivale a `CONSULTA`**, el más bajo. Nunca se concede
  privilegio por omisión.
- **Los cambios de papel surten efecto al siguiente inicio de sesión**, porque
  el papel se lee una vez al entrar.
- **No hay autoservicio de recuperación.** El administrador restablece la clave
  desde la consola.

### Flujos alternativos
- **Nómina o clave incorrecta:** mensaje genérico, sin distinguir cuál de los
  dos falló
- **`estatus` es `BAJA`:** se rechaza el acceso y se cierra la sesión
- **`apps` no incluye `rrhh`:** se rechaza el acceso y se cierra la sesión
- **Sin conexión:** se avisa que no se pudo verificar la identidad

---

# SPEC-002 — Papeles y permisos

**Estado:** implementado
**Nuevo en la v2**

### Papeles
`ADMIN`, `CAPTURA` y `CONSULTA`, tomados de `roles.rrhh` en la suite.

### Matriz de permisos

| Acción | ADMIN | CAPTURA | CONSULTA |
|---|:--:|:--:|:--:|
| Ver el directorio de personal | sí | sí | sí |
| Alta o edición de un colaborador | sí | no | no |
| Dar de baja o reactivar | sí | no | no |
| Importar desde Excel | sí | no | no |
| Eliminar un colaborador | sí | no | no |
| Ver incidencias | sí | sí | sí |
| Registrar incidencias | sí | sí | no |
| Registrar capacitación y cursos | sí | sí | no |
| Registrar vacantes | sí | sí | no |
| Exportar a Excel y PDF | sí | sí | sí |

### Reglas de negocio
- **El padrón tiene la puerta más angosta.** `colaboradores` sostiene el inicio
  de sesión de las cinco apps de la suite, así que solo `ADMIN` lo escribe.
  `CAPTURA` alimenta los datos propios de RRHH pero no toca el padrón.
- **`CONSULTA` sí exporta.** Es descarga bajo demanda y no modifica nada.
- **`CONSULTA` ve las incidencias de toda la planta.** Decidido a conciencia:
  las quince cuentas actuales entran con este papel y ven faltas
  injustificadas, incidencias del reglamento e incapacidades de las 121
  personas, con nombre, fechas y motivo. Como también pueden exportar,
  cualquiera de ellas puede descargar ese historial completo a un Excel. Se
  aceptó el riesgo: son empleados de confianza y la alternativa —ocultar el
  módulo— dejaba sin uso una parte de la aplicación.
- **`CAPTURA` queda definido pero sin usar todavía.** Existirá cuando se agregue
  la sección donde estos quince capturen. Hoy nadie lo tiene asignado.
- **Los módulos que el papel no permite escribir se muestran igual**, en modo
  lectura. Ocultarlos haría creer que no existen.

---

# SPEC-003 — Directorio de personal

**Estado:** implementado
**Actor:** `ADMIN` para escribir; cualquier papel para leer

### Precondiciones
- Sesión iniciada

### Flujo principal
1. Sistema se suscribe a la colección `colaboradores` del proyecto
   **impredimex-suite**
2. Sistema muestra la lista ordenada numéricamente por nómina, con búsqueda y
   paginación
3. `ADMIN` puede dar de alta, editar, dar de baja o importar

### Reglas de negocio
- **Esta es la única lista de personal válida de toda la suite.** Ninguna otra
  app la escribe, ni guarda su propia copia, ni tiene nombres en el código.
- **RRHH es la única app que escribe aquí.** Es su responsabilidad y también su
  riesgo: un error en este módulo se propaga a las cinco apps.
- **`apps`, `roles` y `rol` no se tocan nunca.** No aparecen en los formularios
  de RRHH y no se escriben. Toda escritura usa `merge` para no borrarlos. Esta
  regla es la que impide que RRHH deje sin acceso a alguien sin darse cuenta.
- **`nombreNormalizado` se recalcula al guardar.** Son las palabras de
  `nombreCompleto` sin acentos, en mayúsculas y **ordenadas alfabéticamente**:
  `MORENO GARCIA VICTOR` se guarda como `GARCIA MORENO VICTOR`. Ordenarlas hace
  que la búsqueda no dependa del orden en que se escriba, así que «Víctor
  Moreno» y «Moreno Víctor» encuentran a la misma persona. Calcularlo de otra
  forma dejaría los registros nuevos en un formato y el resto de la colección en
  otro, y las búsquedas de las demás apps fallarían a medias.
- **Cada escritura deja `actualizadoEn` y `actualizadoPor`**, con la nómina de
  quien la hizo. Hasta ahora no había forma de saber quién tocó el padrón.
- **`departamento` pertenece a un catálogo cerrado de 13 valores.** Se comparan
  como texto exacto en varias apps: un acento o una mayúscula distinta deja a un
  trabajador sin equipo de protección asignado en EPP, y falla sin avisar.
- **La antigüedad no se guarda.** Se calcula al vuelo desde `fechaIngreso`.
  Guardarla significa que queda desactualizada cada mes.

### Flujos alternativos
- **La suite no responde:** la lista se muestra vacía con un aviso claro, no en
  blanco sin explicación

---

# SPEC-004 — Alta y edición de un colaborador

**Estado:** implementado
**Actor:** `ADMIN`

### Flujo principal
1. Usuario llena nómina, nombre completo, puesto, fecha de ingreso y
   departamento
2. Sistema normaliza el nombre, el puesto y el departamento a mayúsculas
3. Sistema calcula `nombreNormalizado`
4. Sistema guarda con `merge` usando la nómina como identificador del documento

### Reglas de negocio
- **La nómina es el identificador del documento.** Guardar con una nómina que ya
  existe actualiza a esa persona, no crea una nueva.
- **El departamento se elige de una lista, no se escribe.** Es lo único que
  evita las variantes con acento distinto.
- **Un alta nueva nace sin `apps` ni `roles`**, o sea sin acceso a ninguna
  aplicación. Darle acceso es un acto aparte y deliberado.

---

# SPEC-005 — Baja, reactivación y eliminación

**Estado:** implementado
**Actor:** `ADMIN`

### Flujo principal — baja
1. Usuario presiona «Dar de baja» sobre un colaborador
2. Sistema pide confirmación
3. Sistema cambia `estatus` a `BAJA`; el documento se conserva completo

### Flujo principal — eliminación
1. Usuario presiona el botón de eliminar
2. Sistema muestra una confirmación que **nombra a la persona** y advierte que
   se perderán sus accesos a las demás aplicaciones
3. Usuario confirma
4. Sistema borra el documento

### Reglas de negocio
- **Dar de baja es lo normal; eliminar es la excepción.** La baja conserva el
  historial y permite reactivar. Eliminar existe solo para registros creados por
  error, por ejemplo con la nómina mal escrita.
- **Eliminar se lleva `apps` y `roles`.** Esa persona pierde el acceso a EPP,
  Procesos y a lo que tuviera, sin dejar rastro. Por eso la confirmación tiene
  que decirlo, no basta un «¿estás seguro?».
- **Una persona en `BAJA` no puede iniciar sesión en ninguna app**, aunque
  conserve `apps` y `roles`.
- **Reactivar es cambiar `estatus` a `ACTIVO`.** No hay que volver a capturar
  nada ni se reasignan permisos: los que tenía siguen ahí.

---

# SPEC-006 — Importación desde Excel

**Estado:** implementado
**Actor:** `ADMIN`

### Flujo principal
1. Usuario selecciona un archivo `.xlsx`
2. Sistema lee la primera hoja y reconoce las columnas de nómina, nombre,
   puesto, fecha de ingreso y departamento
3. Sistema descarta las filas sin nómina o sin nombre
4. Sistema compara contra lo que ya existe y muestra un **resumen previo**:
   cuántas altas, cuántas actualizaciones, y **qué personas en `BAJA` serían
   reactivadas**, con nombre y nómina
5. Usuario confirma o cancela
6. Sistema guarda en lote, con `merge`

### Reglas de negocio
- **La importación nunca reactiva a nadie en silencio.** Si el archivo trae a
  alguien que está en `BAJA`, se lista antes y el usuario decide. Hoy la
  aplicación fuerza `ACTIVO` en todos los registros importados, así que volver a
  subir la plantilla completa revive a todo el personal dado de baja sin avisar.
- **Un alta que llega por importación nace `ACTIVO`.** Una persona que ya existe
  conserva su estatus salvo que el usuario acepte reactivarla.
- **La importación pisa nombre, puesto, fecha y departamento con lo que traiga
  el archivo.** Si el Excel viene mal, el padrón queda mal. Es la vía por la que
  entró el error de las nóminas 2396 y 2398.
- **Los departamentos que no pertenezcan al catálogo cerrado se reportan como
  error** y esas filas no se guardan. Es preferible rechazar una fila a meter
  «FLEXOGRAFIA» sin acento y dejar a esa gente sin EPP asignado.
- **`apps` y `roles` no se tocan.** Aplica la regla de la SPEC-003.

### Flujos alternativos
- **Ninguna fila válida:** se avisa qué columnas se esperaban
- **Archivo ilegible:** se avisa y no se guarda nada

---

# SPEC-007 — Módulos propios de RRHH

**Estado:** implementado
**Actor:** `ADMIN` para escribir; `CAPTURA` y `CONSULTA` para leer

### Alcance
Incidencias, capacitación, cursos, antigüedad y vacantes.

### Reglas de negocio
- **Estos datos se quedan en el proyecto propio de RRHH**, no en la suite. Es
  deliberado y no debe «optimizarse» juntándolo todo: el plan gratuito da cuota
  por proyecto, y concentrar las cinco apps en uno la colapsaría. La suite solo
  carga con identidad y directorio.
- **Los registros guardan copia, no referencia.** Una incidencia conserva la
  nómina **y** el nombre tal como estaban al capturarla, para que el histórico
  no cambie si después se corrige el padrón.
- **La antigüedad se calcula al vuelo** desde `fechaIngreso`. No se guarda.
- **Solo `ADMIN` captura (v2.3).** Quien no lo sea no ve formularios de alta,
  botones de eliminar ni edición en línea en ningún módulo: ve un aviso de
  modo consulta. `CAPTURA` perdió la escritura aquí y se comporta como
  `CONSULTA`; el papel sigue vigente en las demás aplicaciones de la suite.
- **Consultar, filtrar, paginar y exportar quedan abiertos a todos.** Una
  descarga a Excel o PDF no modifica nada, así que no se restringe.
- **Ocultar el formulario no es el control de acceso.** Lo que impide de
  verdad la escritura son las reglas de la SPEC-008; la interfaz solo evita
  que alguien intente algo que la base le va a rechazar.

---

# SPEC-008 — Reglas de acceso a los datos

**Estado:** pendiente
**Nuevo en la v2**

### Alcance
Dos proyectos con reglas distintas.

### Proyecto de la suite — `colaboradores`
Las reglas deben permitir la lectura a cualquier sesión autenticada, porque las
cinco apps necesitan el directorio, y **restringir la escritura**. Como las
reglas de un proyecto no pueden validar los tokens de otro, y aquí la sesión sí
es del propio proyecto suite, la escritura puede exigir que la nómina de quien
escribe tenga `rrhh` en su campo `apps` y `ADMIN` en `roles.rrhh`.

### Proyecto propio de RRHH
Cada app inicia además una sesión anónima en su propio proyecto, y las reglas
exigen esa sesión junto con App Check. Eso cierra el acceso a extraños pero no
distingue entre usuarios. Riesgo aceptado a conciencia: la trazabilidad no
depende de las reglas sino de los datos que la app graba.

### Reglas de negocio
- **Hoy no hay ninguna regla que impida escribir el padrón.** La aplicación no
  tiene control de acceso y el repositorio es público, así que cualquiera con la
  dirección puede alterar la lista de personal. Es lo más urgente de esta
  versión.
- **El orden de puesta en marcha no se puede invertir:** primero se publica la
  aplicación con sesión y App Check en monitoreo, se verifica, y hasta entonces
  se aplican las reglas. Al revés, la versión que está en producción deja de
  funcionar en ese momento.

---

# SPEC-009 — Migración del padrón a la suite

**Estado:** implementado

### Qué resultó ser
Esta spec se escribió esperando una reconciliación delicada entre dos listas
divergentes. Al revisar los datos reales, ese trabajo no existía.

El proyecto propio de RRHH tenía **tres** colaboradores —86, 852 y 885—, todos
con el formato viejo: `updatedAt` en inglés, sin `nombreNormalizado`, sin `apps`
ni `roles`. Eran registros de prueba de cuando se construyó la aplicación.

Los 121 de la suite nunca salieron de esa aplicación: se cargaron directo desde
un archivo de Excel el 3 de septiembre de 2026, con una herramienta aparte. Por
eso las dos colecciones nunca estuvieron sincronizadas ni tenían por qué estarlo.

Verificado que las tres nóminas ya existían en la suite con sus datos correctos,
la migración se redujo a cambiar el origen de la base en `personalService.ts`.

### Reglas de negocio
- **El padrón queda solo en la suite.** Los tres registros del proyecto
  `rrhh-pwa` dejan de leerse y se eliminan a mano, para que nadie encuentre
  después una segunda colección `colaboradores` y dude de cuál es la buena.
- **Los demás módulos no se mueven.** Incidencias, capacitación, cursos y
  vacantes siguen en el proyecto propio, con datos reales. Es la regla 4 de la
  suite: la cuota del plan gratuito es por proyecto.
- **La corrección de las nóminas 2396 y 2398 sigue pendiente**, y ahora es un
  trabajo aparte que se hace desde la propia aplicación, ya no parte de una
  migración.

---

# SPEC-010 — Instalación como aplicación

**Estado:** parcialmente implementado
**Actor:** cualquier usuario

### Reglas de negocio
- **Los iconos deben vivir en el repositorio.** Hoy el manifiesto apunta a
  `cdn-icons-png.flaticon.com`, un servicio ajeno: si cambia o el dispositivo
  está sin red al instalar, la app queda sin icono. Tampoco hay
  `apple-touch-icon`, así que en iPhone la pantalla de inicio usa una captura en
  vez de un icono.
- **El icono distingue a esta app de las demás.** Las cinco comparten marca; el
  de RRHH es la silueta de dos personas.
- **Los colores son los de la suite:** `#003580` en `theme_color` y
  `background_color`. Hoy declara `#2563eb` y `#f8fafc`.

---

# SPEC-011 — Registro de incidencias

**Estado:** implementado
**Actor:** `ADMIN` y `CAPTURA` para capturar; `CONSULTA` para ver y exportar

### Flujo principal
1. El usuario selecciona al colaborador, el tipo de incidencia y, si aplica,
   escribe observaciones libres.
2. Si la incidencia implica una suspensión, marca la casilla **Suspensión**.
   Eso pide primero el número de días y después abre un calendario donde se
   eligen esos días uno por uno; no tienen que ser consecutivos.
3. Al guardar, la incidencia queda con la nómina y el nombre del colaborador
   copiados tal como estaban en ese momento (regla general de la SPEC-007).

### Postcondiciones
- Se crea un documento en `incidencias` (proyecto `rrhh-pwa`) con `tipo`,
  `observaciones`, `suspension` y, si aplica, `diasSuspension` y
  `fechasSuspension` (una fecha `YYYY-MM-DD` por cada día elegido).
- El botón **Guardar Incidencia** queda deshabilitado mientras el número de
  fechas elegidas no coincida exactamente con `diasSuspension`.

### Reglas de negocio
- **No hay fecha de inicio y fin genéricas.** La v2.1 las retira: la única
  fecha que la aplicación captura es la de una suspensión real, y son fechas
  puntuales elegidas a mano, no un rango.
- **El estatus de aprobación se retira.** La versión anterior guardaba un
  campo `estatus` que solo podía valer `APROBADO`: no había ningún flujo que
  lo cambiara, así que no describía nada real.
- **El historial muestra # Nómina, Nombre, Tipo, Suspensión, Observaciones y
  Acción.** La columna Suspensión lista las fechas elegidas si la incidencia
  las tiene, o un guion si no.
- **El indicador de "días acumulados" del resumen ahora cuenta solo días de
  suspensión.** El total genérico que existía antes perdió sentido al quitarse
  el rango de fechas: ya no hay un número de días asociado a una falta o un
  retardo, así que sumar «días» de todas las incidencias por igual ya no
  describía nada real.

### Flujos alternativos
- Si se cambia el número de días de una suspensión ya en captura, las fechas
  elegidas se borran y hay que volver a marcarlas: evita que queden fechas de
  más o de menos sin que el usuario se dé cuenta.

---

# SPEC-012 — Sucesos y rol de turnos

**Estado:** implementado
**Actor:** cualquier sesión, sea o no `ADMIN`

### Alcance
Pestaña **Sucesos y Turnos**. Es la excepción deliberada a la SPEC-007: aquí
la captura está abierta a todos, porque quien levanta un reporte de piso o
arma un rol es precisamente quien está en el turno, no un administrador.

### Sucesos

1. Quien reporta elige fecha, colaborador y tipo de suceso, y puede describirlo.
2. Al guardar, el suceso conserva nómina, nombre y departamento del colaborador
   **y** la nómina y el nombre de quien lo reportó, copiados en ese momento.

Catálogo: no se presentó a laborar, abandonó el turno, llegada tarde, cambio de
turno, accidente o incidente, otro.

- **Un suceso siempre va ligado a una persona.** No existen sucesos generales.
- **Un suceso no es una incidencia.** No afecta nómina, suspensiones ni el
  historial de la SPEC-011: es bitácora de lo ocurrido, nada más.
- **Solo `ADMIN` puede borrar un suceso.** Un reporte no se deshace porque a
  quien lo levantó le haya incomodado después.
- Todos pueden filtrar la bitácora y exportarla a Excel y PDF.

### Rol de turnos

Réplica del módulo de turnos de la aplicación de Mantenimiento (su SPEC-016),
reescrita para React y Firestore. Sirve para saber dónde está ubicado el
personal, no para calcular nómina.

1. Se captura nombre, **departamento**, periodo y fecha de inicio.
2. El sistema genera una cuadrícula: una fila por persona activa de ese
   departamento, una columna por día del periodo.
3. Se asigna un turno por celda.

| Clave | Horario | | Periodo | Días |
|---|---|---|---|---|
| `T1` | 06:00 – 14:00 | | Semanal | 7 |
| `T2` | 14:00 – 21:30 | | Quincenal | 14 |
| `T3` | 21:30 – 06:00 | | Mensual | el mes completo (28–31) |
| `D12` | 06:00 – 18:00 |
| `N12` | 18:00 – 06:00 |
| `G8` | 08:00 – 18:00 |
| `LIB` | horario libre, se capturan entrada y salida |

Una celda vacía significa descanso. Los domingos se resaltan.

### Reglas de negocio
- **El departamento se elige al crear el rol** y determina qué personas salen
  en la cuadrícula. Solo aparece personal activo.
- **Cualquiera puede crear un rol; solo quien lo creó o un `ADMIN` puede
  editarlo o borrarlo.** Los demás lo abren en modo lectura, con la cuadrícula
  deshabilitada y sin botón de guardar, para que nadie capture un periodo
  entero y descubra al final que no podía guardarlo.
- **Cambiar periodo o fecha de inicio conserva solo las asignaciones cuyas
  fechas siguen dentro del rango**; las que quedan fuera se descartan, porque
  arrastrarlas haría reaparecer turnos de días que ya no son del rol.
- **Cambiar de departamento vacía las asignaciones**, ya que la lista de
  personas deja de ser la misma.
- **Con `LIB` se piden entrada y salida** en formato `HH:MM` de 24 horas, y se
  validan.
- **El portapapeles guarda una copia independiente.** Editar la celda de origen
  no altera las que ya se pegaron. Vive solo durante la edición.
- **Las fechas se generan con aritmética de calendario**, no sumando
  milisegundos: con el horario de verano un día dura 23 o 25 horas dos veces al
  año y el periodo repetiría o se saltaría un día.
- Cada rol se exporta a Excel con una fila por persona y una columna por día.

### Deuda
Igual que el resto de esta aplicación, la restricción de quién puede editar un
rol vive en la interfaz. Las reglas del proyecto de RRHH usan sesión anónima y
no distinguen usuarios (SPEC-008), así que no pueden sostenerla.

---

# SPEC-013 — Quién puede programar turnos

**Estado:** implementado
**Actor:** `ADMIN` asigna; cualquiera puede resultar asignado

### Por qué
La SPEC-012 dejó la creación de roles abierta a todos. En la práctica cada área
tiene a quien le toca programarla, y un rol capturado por quien no conoce la
línea es peor que no tener rol.

### Cómo funciona
- Cada colaborador puede tener `departamentosTurnos`: la lista de departamentos
  cuyos roles puede crear y editar. Vacío o ausente significa que solo consulta.
- `ADMIN` puede programar **todos** los departamentos sin aparecer en ninguna
  lista, y es el único que puede asignar permisos a los demás.
- La asignación se hace desde la pantalla **Permisos**, dentro de la pestaña de
  Sucesos y Turnos, visible solo para `ADMIN`. Cada marca se guarda al
  instante.

### Reglas de negocio
- **El permiso es por departamento, no por autoría.** Quien puede programar un
  área puede corregir cualquier rol de esa área, lo haya creado o no. Es lo que
  hace falta cuando varios supervisores cubren la misma línea, o cuando alguien
  falta y su rol hay que ajustarlo igual. Esto **reemplaza** la regla de la
  SPEC-012, donde mandaba quien lo había creado.
- **Consultar y exportar siguen abiertos a todos.** El candado es solo sobre
  crear y editar.
- **Un rol que no se puede editar se abre en modo lectura**, con la cuadrícula
  deshabilitada y sin botón de guardar.
- **El selector de departamento solo ofrece los permitidos**, así que no es
  posible crear un rol de un área ajena ni por descuido.
- **La lista de departamentos sale del padrón**, no de un catálogo escrito a
  mano: si mañana nace un área, aparece sola.
- **Los permisos asignados se cruzan contra los departamentos que existen hoy.**
  Si un área se renombra o se queda sin personal, deja de ofrecerse aunque el
  permiso siga guardado; no se borra, por si el área vuelve.

### Por qué el campo vive en el padrón y no en el código
Un archivo de configuración obligaría a editar y recompilar cada vez que alguien
entra, sale o cambia de área, y ataría los permisos a nombres o nóminas escritos
a mano. En el padrón, `ADMIN` los cambia solo.

`departamentosTurnos` **no** viaja en `construirDocumento`: si lo hiciera, una
importación de Excel sin esa columna borraría todos los permisos en cada carga.
Solo lo escribe `asignarDepartamentosTurnos`, desde la pantalla de permisos.

### Deuda
Igual que el resto de la aplicación, el candado vive en la interfaz. Las reglas
del proyecto de RRHH usan sesión anónima y no distinguen usuarios (SPEC-008),
así que no pueden sostenerlo.

---

# SPEC-014 — Asistencia confirmada por EPP

**Estado:** implementado
**Aplicaciones:** EPP escribe, RRHH lee

### Por qué
Una revisión de EPP no se le puede hacer a alguien que no vino. La inspección
es, por sí misma, prueba de que la persona estuvo presente. Y como la revisión
es obligatoria para todo el personal, su ausencia significa que esa persona no
se presentó.

### Cómo viaja el dato
EPP guarda sus inspecciones en Realtime Database de su propio proyecto, que
desde RRHH no se ve. El puente es la colección `asistencia` del proyecto
**`impredimex-suite`**, el único terreno que las dos aplicaciones ya comparten.

Al guardar una revisión, EPP escribe un documento con id `AAAA-MM-DD_nómina`:
`fecha`, `noNomina`, `nombreCompleto`, `departamento`, `origen: 'EPP'` y `ts`.
RRHH consulta esa colección por rango de fechas y marca su cuadrícula.

### Cómo se ve
Dentro de la celda del turno, a la derecha: una palomita verde si asistió, una
cruz roja si no. Sin texto, para que un rol mensual de 31 columnas siga siendo
legible. El detalle aparece al mantener el cursor encima.

### Reglas de negocio
- **El documento va sin foto, sin firma y sin el detalle del EPP.** Leer los
  registros completos desde RRHH acabaría con la cuota del plan gratuito: esos
  registros llevan imágenes en base64.
- **Un documento por persona y día.** Una segunda revisión el mismo día
  sobrescribe, no duplica.
- **Solo se evalúan celdas con turno asignado.** Un descanso no es una falta.
- **La falta solo se afirma cuando el turno ya terminó.** Antes de la hora de
  salida, que no haya revisión no significa nada: alguien de T2 entra a las
  14:00, y darlo por ausente en la mañana sería inventar una falta. El
  «Asistió», en cambio, aparece en cuanto se hace la revisión: solo se hace
  esperar al dato que puede equivocarse.
- **Se contemplan los turnos que cruzan la medianoche.** Un `T3` o un `N12` del
  día 14 terminan a las 06:00 del 15, y hasta esa hora no se juzgan. En `LIB`
  se usan las horas capturadas a mano; si una salida es anterior o igual a la
  entrada, se entiende que cruza la noche. Un `LIB` sin horas nunca se da por
  terminado, que es el lado que no inventa faltas.
- **La cuadrícula se refresca sola cada minuto**, para que una celda cambie de
  estado al terminar el turno aunque la pantalla lleve rato abierta.
- **RRHH solo lee.** La asistencia nunca se marca a mano desde el rol de
  turnos: si se pudiera, dejaría de ser lo que la revisión constató.
- **La consulta va por rango**, no trayendo la colección entera. `asistencia`
  crece con cada revisión de cada persona, todos los días.

### Modos de fallo, y por qué se avisan
Si la escritura falla en EPP, la inspección **sí** se guarda —es lo prioritario—
pero se muestra una advertencia. Si la lectura falla en RRHH, se registra el
error y la exportación se cancela con aviso.

La razón es la misma en los dos casos: en silencio, el sistema reportaría como
ausente a gente que sí vino. Un fallo visible es molesto; uno callado genera
faltas falsas en un tema que toca nómina y disciplina.

### Requisito de configuración
La colección `asistencia` del proyecto de la suite necesita su regla: **EPP
escribe, RRHH lee**. Sin ella, la advertencia de arriba aparecerá en cada
revisión y RRHH no marcará a nadie.

### Deuda
La asistencia se infiere de que exista una revisión. Si un supervisor no alcanza
a hacerla, esa persona aparece como ausente aunque haya venido. Es el precio
aceptado a cambio de no capturar la asistencia dos veces, y descansa sobre la
regla de que la revisión de EPP es obligatoria para todos.

---

# SPEC-015 — Reporte de faltas

**Estado:** implementado
**Actor:** cualquiera puede pedirlo; solo algunos, de todas las áreas a la vez

### Qué es
Ventana emergente desde la pestaña de Sucesos y Turnos. Se pide un periodo y un
departamento, y devuelve la lista de faltas, con descarga a Excel y PDF.

### Cómo se calcula una falta
Una falta existe donde se cumplen las tres cosas: **había turno asignado**, ese
**turno ya terminó**, y **no hubo revisión de EPP**. Es la misma regla que pinta
la cruz roja en la cuadrícula (SPEC-014), aplicada sobre un rango.

El recorrido va por los roles, no por el padrón: son los roles los que dicen
quién debía trabajar cada día. Quien no tiene turno asignado no puede faltar.

### Reglas de negocio
- **La opción «Todos los departamentos» está restringida.** La ven los `ADMIN` y
  quien tenga `reporteFaltasTodas` en su documento del padrón. El resto elige un
  departamento a la vez.
- **El botón lo ve todo el mundo.** Consultar y exportar roles ya estaba abierto
  a todos (SPEC-012); restringir el reporte por departamento sería incoherente
  con eso.
- **Dos roles del mismo departamento pueden solaparse en fechas.** Las faltas se
  deduplican por persona y día, o la misma se contaría dos veces.
- **Si la lectura de asistencias falla, no se entrega reporte.** Sin ellas, todo
  turno terminado parecería falta y el reporte acusaría a quien sí vino.
- **Un periodo que incluye días futuros no los reporta**, porque sus turnos no
  han terminado.

### Por qué `reporteFaltasTodas` y no `ADMIN`
Quien necesita el reporte completo es Recursos Humanos, por función. Hacerlo
`ADMIN` para conseguirlo le daría además permiso para programar los roles de
toda la planta, que es justo lo que la SPEC-013 quiso evitar. Son dos cosas
distintas y se marcan por separado, desde la misma pantalla de Permisos.

`reporteFaltasTodas` **no** viaja en `construirDocumento`, por la misma razón que
`departamentosTurnos`: un Excel sin esa columna borraría la marca en cada carga.

---

# SPEC-016 — Promociones internas

**Estado:** implementado
**Actor:** `ADMIN` y quien tenga `capturaPromociones`; el resto solo consulta

### Qué es
Sección dentro de la pestaña de Capacitación, debajo de la matriz. Registra la
evaluación de un colaborador para **contrato de planta**, **nueva categoría
dentro de su mismo puesto** o **cambio de puesto**.

### Flujo
1. Se elige colaborador, tipo, fecha de inicio del periodo y, salvo en contrato
   de planta, la categoría o el puesto de destino.
2. La evaluación nace **en proceso**, con un periodo de tres meses.
3. Cada mes se captura una calificación de 0 a 100. La aplicación calcula las
   fechas en que toca cada una y muestra el promedio de las capturadas.
4. Al cerrar el periodo se marca **aprobada** o **rechazada**.

### Reglas de negocio
- **Los datos del colaborador se copian al abrir la evaluación**, incluido el
  puesto actual, para que el histórico no cambie si después se corrige el
  padrón. Es la misma regla de la SPEC-007.
- **El destino no aplica en un contrato de planta**, y en ese caso el campo no
  se escribe: Firestore rechaza el documento entero si encuentra un campo en
  `undefined`.
- **Las calificaciones se guardan solo del mes ya evaluado**, con clave `'1'`,
  `'2'` y `'3'`, en vez de tres campos que nacerían vacíos, por la misma razón.
- **Las fechas de evaluación son meses de calendario, no bloques de 30 días.**
  Si el día no existe en el mes destino —un periodo que empieza el 31 de enero,
  cuyo primer corte caería el 31 de febrero— se recorta al último día del mes.
- **El promedio se calcula solo sobre las calificaciones capturadas**, así que
  un periodo a la mitad no se castiga por los meses que faltan.
- **Consultar está abierto a todos; capturar y calificar, no.**

### Por qué `capturaPromociones` y no `ADMIN`
Quien lleva estas evaluaciones es Recursos Humanos. Volverlos `ADMIN` les daría
además permiso sobre el padrón y sobre los roles de turnos de toda la planta.
Se marca por separado, desde la pantalla de Permisos, y así las dos plazas de
RH que hoy están vacantes se habilitan el día que se ocupen sin tocar código.

---

# Deuda técnica conocida

| # | Asunto | Estado |
|---|---|---|
| 1 | Sin ningún control de acceso | **Se resuelve** con la SPEC-001 |
| 2 | El padrón vive en el proyecto equivocado | **Resuelto** |
| 3 | Eliminar borra sin confirmación y se lleva los permisos | **Resuelto** |
| 4 | La importación revive bajas en silencio | **Resuelto** |
| 5 | `nombreNormalizado` no se recalcula | **Resuelto** |
| 6 | Los departamentos se escriben libres, sin catálogo | **Resuelto** |
| 7 | Iconos alojados en un servicio ajeno | **Se resuelve** con la SPEC-010 |
| 8 | Sin `CHANGELOG.md` | **Se resuelve** en esta versión |
| 9 | `favicon` apunta a `/vite.svg`, que no existe en `public/` | Pendiente |
| 9b | `tsc` no corría limpio: faltaban los tipos de Vite y `main.tsx` importaba con extensión | **Resuelto** |
| 10 | Los permisos sobreviven solo gracias al `merge` | **Resuelto**: la escritura usa una lista blanca de campos explícita |
| 11 | Repositorio público | Pendiente hasta migrar el hosting |
| 12 | Los módulos de incidencias, cursos y vacantes siguen sin especificar | Incidencias documentado en la SPEC-011; cursos y vacantes, pendiente |

---

# Asignación de acceso

Las quince cuentas existentes reciben `rrhh` en su campo `apps`.

| Papel | Quiénes |
|---|---|
| `ADMIN` | Víctor Moreno García y Maritza Galván Rivas |
| `CONSULTA` | Las trece cuentas restantes |
| `CAPTURA` | Nadie por ahora |

El puesto de Gerente de Recursos Humanos está vacante. **No se crea una cuenta
genérica para entregarla después:** el modelo de la suite descansa en que una
cuenta es una persona, y los registros de las otras apps graban nómina y nombre
de quien los hizo. Cuando se contrate, se da de alta como cualquier otra persona
y se le asigna `ADMIN`.

Estos cambios se hacen documento por documento en la consola de Firebase, sobre
`colaboradores` del proyecto suite. No requieren tocar código.
