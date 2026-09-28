# Brag Plan: LuzAlerts

## What is this app?
Mapa en tiempo real de cortes de luz en Paraguay: datos oficiales de la ANDE + reportes de vecinos, con alertas push.

## The angle
Un video para el paraguayo que ya conoce el momento: se va la luz y lo primero que hace es preguntar "¿se fue en todo el barrio?". El video *empieza* con la pantalla apagándose y termina con la luz volviendo. Voseo paraguayo/rioplatense, cero jerga SaaS. Pensado como pieza vertical para mostrarse dentro de la app (onboarding / pantalla de bienvenida) y para compartir en WhatsApp/Status.

## Hook (0–3s)
Pantalla negra. Un foco parpadea y se apaga. Texto: "¿Se fue la luz?" con un rayo ámbar. Sin explicación todavía.

## Key moments
- Mapa oscuro con marcadores que aparecen uno por uno: amarillo (programado), rojo (activo), violeta (vecinos), verde (resuelto).
- Notificación push: "Corte a 2 km de tu casa" y después "Volvió la luz".
- Botón "Sin luz": contador 1 → 2 → 3 vecinos, "Corte confirmado".

## Outro / punchline
"Dejá de preguntarte si volvió la luz." + LuzAlerts · Gratis · Sin anuncios · Android · luzalerts.lat.

## User flow worth showing
Abrir la app (mapa) → recibir alerta cercana → reportar "Sin luz" y confirmar entre vecinos.

## Tone
- Preset: app-store
- Creative direction: cálido, cercano, humor suave de barrio ("cuando se va la luz, se arma el grupo de WhatsApp")
- Interpretation: tarjetas limpias, transiciones suaves sobre el beat, un solo chiste (el apagón del inicio).

## Format: vertical — 1080x1920
## Duration: 23s

## Visual identity (from the project)
- Background: #0F172A (slate 900), surfaces #1E293B, borders #334155
- Accent: #FBBF24 (ámbar); rojo #EF4444, verde #22C55E, violeta #A855F7
- Text: #F8FAFC; muted #94A3B8
- Display font: Inter (sitio y app)
- Strongest visual element: mapa oscuro con marcadores por color + tarjeta de outage

## Share copy (draft)
Se fue la luz y no sabés si es tu casa o todo el barrio. LuzAlerts te lo dice: mapa en vivo de cortes en Paraguay, datos de la ANDE + vecinos. Gratis, sin anuncios. luzalerts.lat

## Audio direction
- Role: warm bed + sparse professional accents
- Music: bundled "Happy Beats – Business Moves vol. 1" (~120 BPM), starts at 0
- Music treatment: fade in 0–1s, lower under the blackout hook, full from 3s, fade out over the last 2s
- Music cue guidance: preset read; beat grid 0.5s from 3.02s; scene cuts on 3.02, 6.03, 11.02, 15.02, 19.02; strong cues 17.02 / 23.02
- Audio-reactive treatment: subtle; music RMS/bass makes the amber glow behind the phone/logo breathe. No waveform visuals.
- SFX posture: sparse, motion-matched (soft impacts on scene reveals, clicks on marker pops and the "Sin luz" tap, card slide on notification)
- Restraint rule: no SFX louder than the music bed; nothing bright on repeats.

## Storyboard

### Scene 1 — Apagón — 3.02s
Foco parpadea → negro. "¿Se fue la luz?" aparece, hold ≥1.5s.
Sequential/interaction: none
Audio intent: silencio tenso bajo, un golpe suave al apagarse.
Transition mood: soft flash ámbar → Scene 2

### Scene 2 — Reveal — 3.0s
"Sabé cuándo y dónde se corta la luz." (copy real del sitio) con logo ⚡ LuzAlerts.
Audio intent: la música entra completa.
Transition mood: slide → Scene 3

### Scene 3 — Mapa — 5.0s
Teléfono con mapa oscuro; 4 marcadores aparecen uno por uno (amarillo, rojo, violeta, verde), cada uno con etiqueta corta. Título "Mapa en tiempo real".
Sequential/interaction: yes — marcadores en beats consecutivos cada 1.0s (2 beats), etiquetas hold ≥0.8s
Audio intent: clicks suaves por marcador.
Transition mood: slide → Scene 4

### Scene 4 — Alerta — 4.0s
Notificación push baja: "⚡ Corte a 2 km de vos · ANDE programó un corte 14:00–16:00". Luego segunda: "💡 Volvió la luz".
Sequential/interaction: yes — dos tarjetas una tras otra
Audio intent: card slide + bong.
Transition mood: clean → Scene 5

### Scene 5 — Vecinos — 4.0s
Botón "Sin luz" se toca; contador de vecinos 1/3 → 2/3 → 3/3; badge verde "Corte confirmado".
Sequential/interaction: yes — simulated tap + 3 pasos
Audio intent: click, luego confirmación.
Transition mood: soft → Scene 6

### Scene 6 — Cierre — 4.0s
"Dejá de preguntarte si volvió la luz." + "LuzAlerts · Gratis · Sin anuncios · Android" + luzalerts.lat. Línea chica: "Proyecto independiente. No afiliado a la ANDE."
Audio intent: golpe final en strong cue 23.02, fade-out.

**Music mood:** upbeat, warm
**Audio summary:** silencio → entra el beat en el reveal → clicks discretos en cada acción → golpe final y fade.
