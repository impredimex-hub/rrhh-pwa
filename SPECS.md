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

**Estado:** parcialmente implementado — el cambio de proyecto queda para la
segunda etapa (ver SPEC-009)
**Actor:** `ADMIN` para escribir; cualquier papel para leer

### Precondiciones
- Sesión iniciada

### Etapas
El destino del padrón cambia en dos tiempos, y el orden no se puede invertir:

1. **Primera etapa (esta versión).** La aplicación gana login, papeles y
   salvaguardas, pero **sigue escribiendo en la colección `colaboradores` de su
   propio proyecto**, que es donde están los datos vigentes.
2. **Segunda etapa.** Una vez ejecutada la migración de la SPEC-009, se apunta
   al proyecto de la suite.

Apuntar a la suite antes de migrar haría que RRHH editara una copia vieja
mientras los datos reales se quedan en el proyecto anterior.

### Flujo principal
1. Sistema se suscribe a la colección `colaboradores` del proyecto vigente
   según la etapa
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
**Actor:** `ADMIN` y `CAPTURA` para escribir; `CONSULTA` para leer

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

**Estado:** pendiente
**Nuevo en la v2** — se ejecuta una sola vez

### Antecedente
RRHH se construyó antes que la suite y escribe en la colección `colaboradores`
de **su propio proyecto**. La suite tiene otra colección con el mismo nombre,
poblada por una carga inicial tomada de RRHH, a la que después se le agregaron
`apps` y `roles`. Las dos listas llevan meses divergiendo.

### Flujo
1. Exportar ambas colecciones
2. Comparar y producir tres listas: quién está solo en RRHH, quién está solo en
   la suite, y en quiénes no coinciden nombre, puesto, fecha o departamento
3. Revisar a mano las diferencias; ahí es donde deben aparecer las nóminas 2396
   y 2398
4. Actualizar los documentos de la suite con los datos de RRHH, **con merge**
5. Verificar que los 121 conserven `apps` y `roles`
6. Recalcular `nombreNormalizado` en todos
7. Apuntar la aplicación al proyecto de la suite para el padrón

### Reglas de negocio
- **La suite manda en `apps` y `roles`; RRHH manda en los datos de personal.**
  Ninguna de las dos listas se sobrescribe entera.
- **Nadie se borra durante la migración.** Quien aparezca solo en una lista se
  revisa a mano antes de decidir.
- **Se corrige 2396 y 2398 antes de terminar.** EPP ya graba el nombre dentro de
  cada registro, así que cada revisión hecha con un nombre equivocado queda
  sellada así para siempre.

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

# Deuda técnica conocida

| # | Asunto | Estado |
|---|---|---|
| 1 | Sin ningún control de acceso | **Se resuelve** con la SPEC-001 |
| 2 | El padrón vive en el proyecto equivocado | **Se resuelve** con la SPEC-009 |
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
| 12 | Los módulos de incidencias, cursos y vacantes siguen sin especificar | Pendiente |

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
