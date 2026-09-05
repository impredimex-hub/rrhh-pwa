# Changelog

Todos los cambios relevantes de la aplicación de Recursos Humanos (`rrhh-pwa`).

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado según [Versionado Semántico](https://semver.org/lang/es/).

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
