/**
 * RF-F42 — el contraste resuelto del widget en un navegador real (issue #96).
 *
 * Nivel de verificación: **resolución**. Estos tests miden el valor que el navegador pinta:
 * el texto, los bordes y el anillo de foco, contra los pisos del contrato. `axe` no tiene
 * regla para el contraste del indicador de foco, así que el anillo se mide con el cálculo
 * propio que comparte con el nivel unitario. Ver
 * `docs/decisions/006-contrato-y-verificacion-de-contraste.md`.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { doneFrame, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";
import { contrastRatio, isTransparent, parseColor } from "../contrast";

/** Una respuesta con un enlace dentro: la burbuja del asistente tiene más de un color. */
const ANSWER = "Usa **Preact** y [Fastify](https://example.com/docs) sobre PostgreSQL.";

async function openChatbox(page: Page, theme?: "light" | "dark"): Promise<void> {
	await page.goto("/");
	await page.evaluate((value) => {
		document.documentElement.dataset.theme = value ?? "";
	}, theme);
	await expect(page.locator(".chatbox")).toBeVisible();
}

async function sendQuestion(page: Page, question = "¿Qué usa Jorge?"): Promise<void> {
	await page.locator("#chatbox-question").fill(question);
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
	await expect(page.locator(".chatbox__message--assistant")).toBeVisible();
	// El markdown se carga de forma diferida: sin esperar al enlace, la burbuja del
	// asistente se mediría sin su color de enlace.
	await expect(page.locator(".chatbox__message--assistant a")).toBeVisible();
}

async function failTurn(page: Page): Promise<void> {
	await page.route("**/api/chat", (route) => route.fulfill({ status: 500 }));
	await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
	await expect(page.locator(".chatbox__status--error")).toBeVisible();
}

type Measurement = {
	what: string;
	kind: "texto" | "borde" | "anillo de foco";
	foreground: string;
	/** Fondos del elemento hacia fuera, del más cercano al más lejano. */
	ownBackgrounds: string[];
	/** Fondos del contenedor hacia fuera, del más cercano al más lejano. */
	outerBackgrounds: string[];
	/** El texto es grande y conserva su propio piso de WCAG. */
	large: boolean;
	/** El token que debería estar pintando el elemento, cuando aplica. */
	token?: string;
	/** El desplazamiento del contorno, en píxeles. */
	offset?: number;
};

/**
 * Mide el widget renderizado: el color de cada texto, el de cada borde visible y el del
 * anillo de foco, con los fondos que quedan alrededor.
 *
 * La resolución del fondo —qué ancestro pinta de verdad— la hace el lado de Node con el
 * `isTransparent` compartido: si se resolviera aquí, habría dos definiciones de
 * "transparente" quecouldrían divergir.
 */
async function collectMeasurements(page: Page): Promise<Measurement[]> {
	// El anillo se dibuja con `:focus-visible`, que solo encaja si la última interacción
	// fue con el teclado. Un `Tab` fija esa modalidad antes de enfocar por script.
	await page.keyboard.press("Tab");

	return page.evaluate(() => {
		const root = document.querySelector(".chatbox") as HTMLElement;

		const backgroundChain = (element: Element, includeSelf: boolean): string[] => {
			const chain: string[] = [];
			let node: Element | null = includeSelf ? element : element.parentElement;
			while (node) {
				chain.push(getComputedStyle(node).backgroundColor);
				node = node.parentElement;
			}
			chain.push(getComputedStyle(document.body).backgroundColor);
			return chain;
		};

		const label = (element: Element): string => {
			const classes = String(element.className ?? "").trim();
			const id = element.id ? `#${element.id}` : "";
			const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
			const name =
				element.tagName.toLowerCase() + id + (classes ? `.${classes.split(/\s+/).join(".")}` : "");
			return text ? `${name} "${text}"` : name;
		};

		/** Un control inactivo está exento del contraste: WCAG lo dice así. */
		const isInactive = (element: Element): boolean => element.closest("[disabled]") !== null;

		const measurements: {
			what: string;
			kind: "texto" | "borde" | "anillo de foco";
			foreground: string;
			ownBackgrounds: string[];
			outerBackgrounds: string[];
			large: boolean;
			token?: string;
			offset?: number;
		}[] = [];

		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			const text = (node.textContent ?? "").trim();
			const element = node.parentElement;
			if (text && element && !isInactive(element)) {
				const style = getComputedStyle(element);
				const size = Number.parseFloat(style.fontSize);
				const weight = Number(style.fontWeight) || 400;
				measurements.push({
					what: `${label(element)} — "${text.slice(0, 30)}"`,
					kind: "texto",
					foreground: style.color,
					ownBackgrounds: backgroundChain(element, true),
					outerBackgrounds: backgroundChain(element, false),
					large: size >= 24 || (size >= 18.66 && weight >= 700),
				});
			}
			node = walker.nextNode();
		}

		for (const element of Array.from(root.querySelectorAll("*"))) {
			if (isInactive(element)) continue;
			const style = getComputedStyle(element);
			const width = Number.parseFloat(style.borderTopWidth);
			if (!width || style.borderTopStyle === "none") continue;
			measurements.push({
				what: `borde de ${label(element)}`,
				kind: "borde",
				foreground: style.borderTopColor,
				ownBackgrounds: backgroundChain(element, true),
				outerBackgrounds: backgroundChain(element, false),
				large: false,
			});
		}

		const focusables = Array.from(
			root.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, a[href]")
		);
		for (const element of focusables) {
			element.focus();
			const style = getComputedStyle(element);
			const width = Number.parseFloat(style.outlineWidth);
			if (!width || style.outlineStyle === "none") continue;
			measurements.push({
				what: `anillo de foco de ${label(element)}`,
				kind: "anillo de foco",
				foreground: style.outlineColor,
				ownBackgrounds: backgroundChain(element, true),
				outerBackgrounds: backgroundChain(element, false),
				large: false,
				// El token que debería estar pintando el anillo: si no coincide, el anillo
				// que se está midiendo es el del navegador, no el del widget.
				token: getComputedStyle(element).getPropertyValue("--chatbox-color-focus").trim(),
				offset: Number.parseFloat(style.outlineOffset) || 0,
			});
			element.blur();
		}

		return measurements;
	});
}

/** El fondo que de verdad pinta: el primero opaco de la cadena. */
function resolveBackground(chain: string[]): string {
	for (const background of chain) {
		if (!isTransparent(background)) return background;
	}
	return chain[chain.length - 1] ?? "#ffffff";
}

/** Pisos del contrato: 4.5:1 para el texto, 3:1 para componentes visuales y anillo de foco. */
const FLOORS: Record<Measurement["kind"], number> = {
	texto: 4.5,
	borde: 3,
	"anillo de foco": 3,
};

/**
 * El desplazamiento del anillo. Con desplazamiento, el anillo se dibuja sobre el fondo del
 * contenedor; sin él, sobre el del control. El valor está aquí para que un cambio de
 * desplazamiento obligue a revisar qué fondo se mide.
 */
const OUTLINE_OFFSET = 2;

function assertContrasts(measurements: Measurement[]): void {
	expect(measurements.length).toBeGreaterThan(0);
	for (const measurement of measurements) {
		// El texto grande conserva su propio piso de WCAG.
		const floor = measurement.kind === "texto" && measurement.large ? 3 : FLOORS[measurement.kind];

		// El texto se pinta sobre su propia superficie; un borde y un anillo desplazado,
		// sobre el fondo del contenedor.
		const chain =
			measurement.kind === "texto"
				? measurement.ownBackgrounds
				: measurement.kind === "anillo de foco" && (measurement.offset ?? 0) === 0
					? measurement.ownBackgrounds
					: measurement.outerBackgrounds;
		const background = resolveBackground(chain);
		const ratio = contrastRatio(measurement.foreground, background);

		expect(
			ratio,
			`${measurement.what}: ${measurement.foreground} sobre ${background}`
		).toBeGreaterThanOrEqual(floor);
	}
}

const tokenValue = (page: Page, property: string): Promise<string> =>
	page
		.locator(".chatbox")
		.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name).trim(), property);

for (const colorScheme of ["light", "dark"] as const) {
	for (const state of ["vacío", "con respuesta", "con error"] as const) {
		test(`RF-F42 — contraste resuelto en ${colorScheme}, ${state}`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await mockChatApi(page, sourcesFrame(), tokenFrame(ANSWER), doneFrame);
			await openChatbox(page);
			if (state === "con respuesta") await sendQuestion(page);
			if (state === "con error") await failTurn(page);

			assertContrasts(await collectMeasurements(page));
		});
	}
}

test.describe("RF-F42 — el anillo de foco", () => {
	test("el anillo desplazado contrasta con la superficie del contenedor", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await mockChatApi(page, sourcesFrame(), tokenFrame(ANSWER), doneFrame);
		await openChatbox(page);

		const rings = (await collectMeasurements(page)).filter(
			(measurement) => measurement.kind === "anillo de foco"
		);

		// Todos los controles enfocables llevan anillo, y el anillo se mide contra el fondo
		// del contenedor: es lo que hay detrás del desplazamiento, no el del control.
		expect(rings.length).toBeGreaterThan(2);
		expect(rings.map((ring) => ring.what)).toContain("anillo de foco de textarea#chatbox-question");

		for (const ring of rings) {
			// El anillo es el del widget y no el que dibuja el navegador: si fuera el del
			// navegador, el contraste dependería del navegador y no del contrato.
			expect(parseColor(ring.foreground), ring.what).toEqual(parseColor(ring.token ?? ""));
			expect(ring.offset, "el desplazamiento decide qué fondo se mide detrás del anillo").toBe(
				OUTLINE_OFFSET
			);
		}
	});
});

test.describe("RF-F42 — el borde del chip al pasar el ratón", () => {
	test("al pasar el ratón el chip alcanza 3:1 contra su superficie elevada", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await mockChatApi(page, sourcesFrame(), tokenFrame(ANSWER), doneFrame);
		await openChatbox(page);

		const chip = page.locator(".chatbox__empty ul button").first();
		await chip.hover();

		const hovered = await page.evaluate(() => {
			const element = document.querySelector(".chatbox__empty ul button") as HTMLElement;
			const style = getComputedStyle(element);
			return {
				border: style.borderTopColor,
				fill: style.backgroundColor,
				outside: getComputedStyle(element.parentElement!.parentElement!).backgroundColor,
			};
		});

		// El borde del chip pasa a ser el color de marca y su relleno a la superficie elevada:
		// el borde tiene que destacar contra los dos lados.
		expect(contrastRatio(hovered.border, hovered.fill)).toBeGreaterThanOrEqual(3);
		expect(contrastRatio(hovered.border, hovered.outside)).toBeGreaterThanOrEqual(3);
	});
});

test.describe("RF-F42 — precedencia de las capas de accesibilidad", () => {
	test("conserva la paleta oscura con el sistema en oscuro y más contraste pedido", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "dark", contrast: "more" });
		await openChatbox(page);

		expect(await tokenValue(page, "--chatbox-color-surface")).toBe("#2f3038");
		expect(await tokenValue(page, "--chatbox-color-text")).toBe("#f1effa");
	});

	test("aplica la paleta de alto contraste con el sistema en claro", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light", contrast: "more" });
		await openChatbox(page);

		expect(await tokenValue(page, "--chatbox-color-surface")).toBe("#ffffff");
		expect(await tokenValue(page, "--chatbox-color-text")).toBe("#000000");
	});

	test("el tema oscuro del host conserva la paleta oscura cuando se pide más contraste", async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: "light", contrast: "more" });
		await openChatbox(page, "dark");

		// El esquema efectivo es el oscuro que declara el host, y esa paleta ya supera
		// todos los pisos: no hay nada que sustituir.
		expect(await tokenValue(page, "--chatbox-color-surface")).toBe("#2f3038");
		expect(await tokenValue(page, "--chatbox-color-text")).toBe("#f1effa");
	});

	test("un tema claro del host sí recibe la paleta de alto contraste", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark", contrast: "more" });
		await openChatbox(page, "light");

		expect(await tokenValue(page, "--chatbox-color-surface")).toBe("#ffffff");
		expect(await tokenValue(page, "--chatbox-color-text")).toBe("#000000");
	});

	test("los colores forzados ganan al tema que declara el host", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
		await openChatbox(page, "dark");

		expect(await tokenValue(page, "--chatbox-color-text")).toBe("CanvasText");
		expect(await tokenValue(page, "--chatbox-color-surface")).toBe("Canvas");
	});
});
