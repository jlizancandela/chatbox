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

case "$command" in
	start)
		if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
			echo "==> Migraciones omitidas (SKIP_MIGRATIONS=1)"
		else
			echo "==> Aplicando las migraciones pendientes"
			./node_modules/.bin/node-pg-migrate up \
				--migrations-dir database/migrations \
				--migrations-table pgmigrations
		fi
		echo "==> Arrancando la API en el puerto ${PORT:-7000}"
		exec ./node_modules/.bin/fastify start -l warn -a 0.0.0.0 -p "${PORT:-7000}" dist/app.js
		;;
	ingest)
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
