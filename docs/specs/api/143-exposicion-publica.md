# Endurecer la exposición pública: timeouts, límites y cuota

> Spec del issue #143. Decisiones de proceso en `docs/decisions/` de la raíz,
> glosario en `GLOSSARY.md`.

## Problema

El chat es público y sin autenticación. El rate limit es, por tanto, la única frontera
que protege el servicio. Hoy esa frontera tiene cuatro agujeros, todos verificados contra
la API en ejecución.

1. **La ráfaga no se aplica.** El plugin de rate limit se registra dos veces en el mismo
   ámbito y el segundo registro sustituye al primero. El límite de 20 por minuto nunca ha
   corrido: la cabecera real responde 100 con ventana diaria.
2. **Sin `trustProxy`, la IP es la del proxy.** Detrás del proxy inverso todos los
   visitantes comparten una sola clave de cuota.
3. **No hay tope global.** El límite por IP no protege contra rotación de IPs. La cuota
   del proveedor es global, así que un atacante con varias IPs agota el día para todos.
4. **No hay timeouts.** `requestTimeout` y `connectionTimeout` valen 0. Una conexión que
   envía el cuerpo a goteo se queda abierta indefinidamente.

## Decisiones

- **D1 — Los dos límites cuentan sobre la misma ruta.** Dos registros del plugin en el
  mismo ámbito no lo consiguen: el segundo sustituye al primero. Se usa la API manual
  del plugin, que permite dos límites encadenados sobre el mismo `routeId`.

- **D2 — La comprobación correcta es la marca de exceso, no la de exclusión.** Con la
  marca de exclusión se rechazan todas las peticiones —medido: 0 aceptadas de 25—. Con
  la de exceso: 20 aceptadas y 5 rechazadas con límite 20. Es una trampa fácil de
  reintroducir.

- **D3 — `trustProxy` se configura con la IP o el rango del proxy**, no con un contador
  de saltos: un cliente directo podría falsificar las cabeceras de reenvío. Sin
  configurar, la aplicación arranca igual en local: no hay proxy, no hay nada que
  confiar.

- **D4 — El tope global se calibra sobre la cuota real medida** del proveedor de
  generación, no sobre una cifra estimada. El valor vive en configuración, no en el
  código.

- **D5 — El tope global corta con su propio código**, distinto del error interno: el
  visitante necesita distinguir "ocupado" de "roto".

- **D6 — `requestTimeout` y `connectionTimeout` llevan valores finitos.** Los valores
  por defecto del framework son 0, y su propia documentación advierte del riesgo de
  denegación de servicio.

- **D7 — El límite por IP sigue existiendo.** El tope global lo complementa, no lo
  sustituye.

- **D8 — La cadena de IPs tiene dos eslabones y ninguno sirve sin el otro.** En el proxy
  del servidor se declara de qué direcciones se aceptan las cabeceras de reenvío; en la
  aplicación, `trustProxy` apunta a la red del proxy. Sin los dos, la IP que llega es la
  del borde y el límite por IP deja de distinguir visitantes.

## Pruebas

- **Test de los dos límites:** verifica que la ráfaga corta antes que el diario y que
  ambos cuentan sobre la misma ruta, leyendo la cabecera del límite.
- **Test de IP tras proxy:** verifica que dos visitantes distintos detrás del mismo
  proxy reciben claves de cuota distintas cuando `trustProxy` está configurado, y la
  misma cuando no lo está.
- **Test del tope global:** verifica que el agotamiento sale con su código propio y no
  con el genérico.
- **Test de timeout:** verifica que una conexión que no completa el cuerpo se cierra en
  vez de quedarse abierta.
- **Test de CORS:** verifica que un origen permitido recibe la cabecera y uno no
  permitido no la recibe.

Los cinco son de comportamiento observable; ninguno afirma sobre nombres internos ni
sobre el orden de los registros del plugin.

## Fuera de alcance

- Autenticación: el chat es público por decisión de producto.
- Configurar el proxy inverso en sí (certificados, entrypoints, enrutado): vive fuera
  del repositorio.
- Detección de bots por firma o captcha.
- Cuotas por usuario: no hay usuarios.
- Los paneles del proxy y de la base de datos, que están expuestos sin autenticación:
  no son parte de este trabajo, pero hay que cerrarlos antes de abrir el chat al
  público.
