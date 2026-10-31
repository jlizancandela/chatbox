#!/bin/sh
# El arranque del contenedor.
#
# `start` (el comando por defecto) aplica las migraciones pendientes y levanta la API.
# `ingest` corre la ingesta del corpus y sale.
#
# El script no compila nada: la imagen trae `dist/` ya compilado.

set -e

command="${1:-start}"
if [ "$#" -gt 0 ]; then
	shift
fi

# Aplica las migraciones pendientes. Es idempotente: `node-pg-migrate` solo aplica lo
# que falta, así que puede correr en cada arranque y en cada ingesta.
migrate() {
	if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
		echo "==> Migraciones omitidas (SKIP_MIGRATIONS=1)"
		return
	fi
	echo "==> Aplicando las migraciones pendientes"
	./node_modules/.bin/node-pg-migrate up \
		--migrations-dir database/migrations \
		--migrations-table pgmigrations
}

case "$command" in
	start)
		migrate
		echo "==> Arrancando la API en el puerto ${PORT:-7000}"
		# `--options` es imprescindible: sin él, fastify-cli **ignora** el `options`
		# que exporta `dist/app.js`, así que el nivel de log, los timeouts y
		# `trustProxy` no se aplican. El servidor arranca igual y la falta no se nota
		# hasta que hace falta un timeout o se mira un log (#143, #146). Comprobado:
		# sin la marca, una petición deja cero líneas de traza.
		exec ./node_modules/.bin/fastify start \
			-l "${LOG_LEVEL:-info}" \
			--options \
			-a 0.0.0.0 \
			-p "${PORT:-7000}" \
			dist/app.js
		;;
	ingest)
		# La ingesta también migra: así funciona sobre una base recién creada, sin
		# depender de que la API haya arrancado antes.
		migrate
		if [ "$#" -eq 0 ]; then
			# Sin nombres, se ingiere todo el corpus que lleva la imagen. El CLI espera
			# los nombres relativos a `ingest/`, no la ruta.
			for file in ingest/*.md; do
				[ -e "$file" ] || continue
				set -- "$@" "$(basename "$file")"
			done
		fi
		exec node dist/cli/ingest.js "$@"
		;;
	*)
		exec "$command" "$@"
		;;
esac
