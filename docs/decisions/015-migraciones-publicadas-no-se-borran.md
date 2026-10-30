# Decisión 015: las migraciones publicadas no se borran ni se renombran

## Estado

Aceptada.

## Contexto

En el pasado se borró un fichero de migración y se sustituyó por otro. El hueco
`004` que se ve en `api/database/migrations/` es la huella de aquello: `003`
sigue ahí y `005` ocupa la posición siguiente.

La herramienta de migraciones (`node-pg-migrate`) compara las migraciones
**aplicadas** con los ficheros **por posición**, no por nombre. Ese detalle es
el que convierte un borrado en un problema y no en un simple desorden.

Consecuencia: cualquier base de datos que hubiera aplicado la migración borrada
queda con un registro huérfano en la tabla de migraciones. A partir de ahí, la
siguiente migración que se añada falla con un error de orden, y ninguna
migración posterior se aplica.

Se comprobó que hoy no hay ninguna base de datos afectada: la migración vivió
un solo día en la rama principal y la base actual nunca la aplico. El riesgo es
latente, no activo. Pero nada escrito impedía repetirlo, y el fallo solo
aparece cuando se añade la migración siguiente —tarde y en el peor momento.

## Decisiones

### La regla

**Una migración publicada no se borra, no se renombra y no se reescribe.**

Las migraciones son un historial, no un estado. Una base de datos lleva su
historial aplicado y el repositorio lleva el historial escrito; los dos tienen
que contar la misma historia, posición por posición.

La regla aplica a toda migración que haya llegado a `main`, aunque la base de
datos de producción todavía no la haya aplicado: el coste de deshacer es
desproporcionado y la protección no cuesta nada.

### Por qué la posición y no el nombre

`node-pg-migrate` registra en `pgmigrations` el nombre de cada migración
aplicada, pero las compara con los ficheros del directorio **por posición** al
calcular cuál es la siguiente. Un fichero borrado desplaza todos los que
estaban detrás, y la herramienta interpreta ese desplazamiento como migraciones
pendientes que no existen o como migraciones ya aplicadas que no están.

Por eso renombrar es tan peligroso como borrar: el contenido del fichero puede
ser idéntico y el efecto es el mismo.

### El síntoma exacto

Cuando una base de datos ha quedado con un registro huérfano, el error aparece
al intentar aplicar la siguiente migración y dice, en substance, que hay una
migración aplicada que no corresponde a ningún fichero, o que el orden de los
ficheros no cuadra con el historial registrado.

La forma concreta depende de la versión de la herramienta, pero el patrón es
siempre el mismo: **la migración que se quiere aplicar no se aplica, y el
problema solo se ve en una base de datos, no en el repositorio**.

Una migración nueva que funciona en local y falla en el servidor es la señal
de que la base de datos tiene un historial que el repositorio ya no refleja.

### Procedimiento de reparación

No se tocan las bases de datos a mano. La reparación es **aditiva**:

1. **Recrear el fichero borrado** con el mismo nombre y **la misma posición**,
   como una migración **no-op**: un `SELECT 1;` o el `-- +migrate Up` / `-- +migrate Down`
   vacío. Su único trabajo es ocupar su sitio en la fila.

2. **Dejar la migración siguiente donde estaba.** Como la posición se recupera,
   las migraciones que ya funcionaban vuelven a alinearse con el historial.

3. **No borrar el registro huérfano.** Si la base tiene una entrada que el
   repositorio no puede ver, y la migración no-op se crea con el nombre
   original, esa entrada vuelve a tener fichero. Si el nombre no coincide
   exactamente, hay que corregir el registro con la herramienta de migraciones
   —`node-pg-migrate` tiene comandos para eso— y nunca con un `UPDATE` a mano
   sobre `pgmigrations`.

4. **Verificar antes de migrar.** Tras aplicar el arreglo, `pnpm db:migrate` debe
   terminar sin error y la tabla `pgmigrations` debe tener una fila por fichero,
   en el mismo orden.

El arreglo es seguro porque una migración no-op no toca datos: solo realinea la
posición.

### Dónde vive la regla

En `docs/decisions/`, que es donde el repositorio guarda el conocimiento de
dominio que no es una spec de implementación. La spec de una feature describe
cómo se construye algo; esta decisión describe una restricción que atraviesa
todas las features.

## Alternativas rechazadas

- **Comprobación automática del orden de las migraciones.** Sería un test que
  verifica que no falta ningún número. Es frágil: las migraciones legítimas
  pueden tener huecos en la numeración (por ejemplo, una que se aplica solo en
  algunos entornos), y un test que prohíbe los huecos acaba obligando a
  inventar migraciones vacías. La regla escrita cubre el caso; el test solo
  cubriría la regla equivocada.

- **Cambiar de herramienta de migraciones.** Resolvería el problema de raíz,
  pero a un coste que no corresponde a una regla de proceso. Y la herramienta
  actual es correcta si se respeta su modelo.

- **Reescribir la historia del repositorio.** Reescribir `main` para que el
  hueco desapareciera solo es posible antes de que nadie haya aplicado la
  migración, y obligaría a todos a resincronizar. No es una opción para un
  repositorio con despliegues.

## Consecuencias

- Una migración que ya no se quiere aplicar se **anula**: se escribe una
  migración nueva que la deshaga. No se borra la anterior.
- Renombrar un fichero de migración es una operación tan peligrosa como
  borrarlo: se trata como borrado.
- El hueco `004` en el directorio no es un error que haya que corregir. Es la
  posición de la migración que se borró y que ya no puede volver a ocuparse sin
  romper las bases que la aplicaron. Está ahí a propósito, y esta decisión es
  la que explica por qué.
