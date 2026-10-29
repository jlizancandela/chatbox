/**
 * El manifiesto que el sitio instala (issue #133).
 *
 * El widget se consume como dependencia de git desde la **raíz** del repositorio, así que
 * lo que el sitio recibe lo deciden dos campos del `package.json` de la raíz: `exports`
 * (por dónde entra) y `files` (qué viaja). Si uno cambia sin el otro, la instalación no
 * falla aquí: el paquete se instala igual y el import del sitio no encuentra el archivo.
 * Ese es el fallo silencioso que este test impide.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MANIFEST_PATH = resolve(REPO_ROOT, "package.json");

type Manifest = {
	name?: string;
	version?: string;
	private?: boolean;
	exports?: Record<string, string>;
	files?: string[];
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
};

const readManifest = (): Manifest => JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

/**
 * `files` es una lista de rutas y directorios: un directorio incluye todo lo que hay
 * debajo. Un archivo suelto se nombra entero.
 */
const coveredByFiles = (files: readonly string[], path: string): boolean =>
	files.some((entry) => path === entry || path.startsWith(`${entry}/`));

/**
 * Los problemas del manifiesto, o una lista vacía si el paquete que instala el sitio
 * está completo. `exists` se inyecta para poder probar el detector con manifiestos que
 * no son el del repositorio.
 */
const manifestProblems = (
	manifest: Manifest,
	exists: (path: string) => boolean = (path) => existsSync(resolve(REPO_ROOT, path))
): string[] => {
	const problems: string[] = [];
	const files = manifest.files ?? [];
	const entries = Object.entries(manifest.exports ?? {});

	if (!manifest.name) problems.push("El paquete no declara nombre.");
	if (!manifest.version) problems.push("El paquete no declara versión.");
	if (manifest.private === true)
		problems.push("El paquete es privado: el sitio no puede instalarlo.");
	if (entries.length === 0) problems.push("El paquete no declara ningún export.");
	if (files.length === 0)
		problems.push("El paquete no declara `files`: viajaría el repositorio entero.");

	for (const [subpath, target] of entries) {
		const path = target.replace(/^\.\//, "");
		if (!exists(path)) {
			problems.push(`El export "${subpath}" apunta a ${path}, que no existe.`);
			continue;
		}
		if (!coveredByFiles(files, path)) {
			problems.push(
				`El export "${subpath}" apunta a ${path}, que \`files\` no incluye: el sitio importaría un archivo que no se instala.`
			);
		}
	}

	if (!manifest.peerDependencies?.preact) {
		problems.push("`preact` tiene que ser peer dependency: la copia la aporta el sitio.");
	}

	return problems;
};

describe("el paquete que instala el sitio", () => {
	it("está completo: los dos exports existen y viajan en el tarball", () => {
		const manifest = readManifest();

		expect(manifestProblems(manifest)).toEqual([]);
		expect(Object.keys(manifest.exports ?? {}).sort()).toEqual([".", "./element"]);
	});

	it("declara el widget, no la app de desarrollo", () => {
		const manifest = readManifest();

		expect(manifest.name).toBe("@jlizancandela/chatbox");
		expect(manifest.exports?.["."]).toBe("./frontend/src/index.ts");
		expect(manifest.exports?.["./element"]).toBe("./frontend/src/element.ts");
	});

	it("no arrastra la app de demo al tarball", () => {
		const files = readManifest().files ?? [];

		expect(coveredByFiles(files, "frontend/src/index.tsx")).toBe(false);
		expect(coveredByFiles(files, "frontend/src/style.css")).toBe(false);
		expect(coveredByFiles(files, "frontend/test/setup.ts")).toBe(false);
	});
});

describe("el detector muerde", () => {
	const probe = (overrides: Partial<Manifest>): Manifest => ({
		name: "@scope/paquete",
		version: "1.0.0",
		exports: { ".": "./frontend/src/index.ts" },
		files: ["frontend/src"],
		peerDependencies: { preact: "^11.0.0" },
		...overrides,
	});
	const exists = (): boolean => true;

	it("rechaza un export que `files` no incluye", () => {
		// El fallo real: alguien afina `files` y el import del sitio se queda sin archivo.
		const problems = manifestProblems(probe({ files: ["frontend/src/components"] }), exists);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("files` no incluye");
	});

	it("rechaza un export que apunta a un archivo que no existe", () => {
		const problems = manifestProblems(
			probe({ exports: { ".": "./frontend/src/no-existe.ts" } }),
			() => false
		);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("no existe");
	});

	it("rechaza un paquete privado", () => {
		expect(manifestProblems(probe({ private: true }), exists)).toContain(
			"El paquete es privado: el sitio no puede instalarlo."
		);
	});

	it("rechaza un paquete sin `files`", () => {
		expect(manifestProblems(probe({ files: [] }), exists)).toContain(
			"El paquete no declara `files`: viajaría el repositorio entero."
		);
	});

	it("rechaza un paquete sin `preact` como peer", () => {
		expect(manifestProblems(probe({ peerDependencies: {} }), exists)).toContain(
			"`preact` tiene que ser peer dependency: la copia la aporta el sitio."
		);
	});
});
