/**
 * Punto de entrada público del paquete.
 *
 * El widget se distribuye **como fuente**: el tarball lleva el TypeScript del widget y
 * es el bundler del sitio quien lo compila. Por eso este módulo solo reexporta: no
 * construye nada ni arranca nada, para que importar el paquete no tenga efectos
 * secundarios.
 *
 * El custom element vive en otro export (`@jlizancandela/chatbox/element`): quien solo
 * quiere el componente no carga el elemento, y quien solo quiere el elemento no carga
 * el resto del widget dos veces.
 *
 * Los estilos viajan con el componente: `Chatbox.tsx` importa su propia hoja, así que el
 * bundler del sitio la emite sin que nadie tenga que importarla a mano.
 */

export type {
	ChatError,
	ChatMessage,
	ChatSource,
	DoneEvent,
	ErrorEvent,
	SourcesEvent,
	TokenEvent,
	TurnState,
	VisibleMessage,
} from "./chat/types";
export type { ChatboxProps } from "./components/Chatbox";
export { Chatbox } from "./components/Chatbox";
