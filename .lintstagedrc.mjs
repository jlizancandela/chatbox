// lint-staged runs from the repository root, but Biome must run inside the
// frontend workspace: when invoked from the root, Biome 2 rejects
// `frontend/biome.json` as a nested root configuration and the hook fails.
// The function form deliberately ignores the staged file list and lints the
// whole frontend (22 files, ~30ms), which is what `npm run lint:fix` does.
export default {
	"frontend/**/*.{ts,tsx,js,jsx,json,css}": () => "npm --prefix frontend run lint:fix",
};
