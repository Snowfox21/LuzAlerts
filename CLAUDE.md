# LuzAlerts: reglas para agentes

## Idioma

- **En español:** mensajes de commit, comentarios en el código, docstrings, textos de PR y sus comentarios, respuestas en revisiones de código, documentación del repositorio.
- **En inglés:** el código en sí (nombres de variables, funciones, tipos, archivos).
- **En ruso:** la conversación con el dueño y con otros agentes, incluidos los mensajes de despliegue que se le entregan al dueño.
- El texto visible para los usuarios de la app va en español, con voseo paraguayo ("tenés", "podés", "avisá").
- No traduzcas comentarios ni commits viejos que están en ruso: la regla vale para lo que escribas de ahora en más.

## Git y PR

- **Nunca hagas push a `main`**: ni fast-forward, ni merge, ni force push. Todo cambio va en una rama aparte. El merge a `main` lo decide el dueño, a través de un PR.
- En una rama ajena (de otro agente o persona): solo commits normales encima, sin rebase ni force push. Avisá al dueño de la rama antes de hacer push.
- Antes de hacer push: tests del backend (`pytest` en `backend/`, necesita PostGIS) y `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` en `mobile/`.
- Apenas abrís un PR, dejá en él un comentario `@codex review` para pedir la revisión de Codex. Respondé sus observaciones en español y, después de corregirlas, volvé a pedirla con otro `@codex review`.

## Después de que se mergea un PR

Entregale al dueño un **mensaje en Markdown (en ruso) listo para mandar a un agente de despliegue**. Tiene que incluir:

- Qué entró (commit del merge, migraciones nuevas, servicios afectados: backend, scraper, Caddy, PWA, APK).
- Los pasos concretos: estado del VPS y cambios manuales, backup de la base si hay migraciones, `git pull --ff-only`, `up -d --build` de los servicios que cambiaron, `--force-recreate caddy` si cambió el `Caddyfile`, `deploy-pwa.sh`, y el APK si hace falta.
- La verificación con `curl` y `docker logs`.
- Las reglas: nada a `main`, nada destructivo en el VPS, commits/comentarios/PR en español.
- Qué tiene que informar el agente al terminar.

Los accesos y el detalle de la infraestructura están en `AI_HANDOFF.md`, que tiene el dueño y no está en git: no copies accesos a este repositorio.
