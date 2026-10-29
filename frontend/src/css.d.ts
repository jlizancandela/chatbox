/**
 * El widget importa su hoja de estilos como efecto secundario (`import "./Chatbox.css"`).
 *
 * El paquete se distribuye **como fuente**: el typecheck del sitio que lo instala lee
 * estos archivos, y sin una declaración del módulo `*.css` ese import se vuelve un error
 * (TS2882). La declaración viaja con el paquete para que el sitio no tenga que
 * arreglarla.
 *
 * Es la misma declaración que aporta `vite/client`, y convive con ella.
 */
declare module "*.css";
