# Reclamo para ANDE — especificación de diseño

Fuente de verdad para implementar la función. Las capturas de cada estado están en
[`reclamo-ande/`](reclamo-ande/). El diseño editable vive en el canvas de Claude Design
«LuzAlerts — Pantallas móviles» (privado del dueño): si el canvas y este archivo no
coinciden, manda este archivo y hay que avisar al dueño.

## Para qué

El bot de WhatsApp de la ANDE (0962 160 160) funciona solo con botones: no se puede
llenar el reclamo por la persona. La persona recorre el menú del bot y, cuando la pasan
con un operador, pega un mensaje que LuzAlerts ya le armó. También puede llamar al 160.

Desde septiembre de 2025 la ANDE pide el NIS para cualquier reclamo. El NIS tiene 7
dígitos y está arriba en la factura.

## Partes

1. Tarjeta «Reclamo para ANDE» en la pantalla del reporte.
2. Fila «Mi NIS de ANDE» en Ajustes.
3. Slide nuevo del onboarding.

Nada de esto toca el backend: el NIS se guarda solo en el teléfono y nunca se manda al servidor.

---

## 1. Tarjeta en la pantalla del reporte

Archivo: `mobile/app/report/[id].tsx`.

### Quién la ve

Solo si el reporte está abierto (`!report.resolved`) **y** la persona es el autor
(`mine`) o ya confirmó el reporte con «Yo también estoy sin luz» (`corroborated`).
En un reporte cerrado o en uno ajeno sin confirmar, la tarjeta no aparece.

### Dónde

Al final de la pantalla, después del bloque «Avisá a tus vecinos» (`ShareBlock`).
Orden completo: encabezado, Ubicación, Momento del reporte, Comentario, Vecinos,
«Ya volvió la luz» (autor) o «Gracias. Tu confirmación ya está en el mapa.» (quien
confirmó), «Avisá a tus vecinos», **Reclamo para ANDE**. Separación con el bloque
anterior: 14 px (igual que `shareSection.marginTop`).

Capturas: [01](reclamo-ande/01-reporte-autor-pide-nis.png),
[02](reclamo-ande/02-reporte-vecino-cuadra-copiado.png),
[03 — pantalla completa](reclamo-ande/03-reporte-pantalla-completa.png).

### Contenido, de arriba abajo

| # | Elemento | Texto exacto |
|---|----------|--------------|
| 1 | Título con ícono de megáfono (`Megaphone` de lucide, `DS.amber`, en un cuadrado de 32 px con fondo `rgba(251,191,36,0.14)`, radio 8) | **Reclamo para ANDE** |
| 2 | Bajada | Escribile a ANDE por WhatsApp al **0962 160 160** o llamá al **160**. Por WhatsApp, cuando te atienda un operador, pegá este mensaje. |
| 3 | Selector de dos opciones | Toda la cuadra · Solo mi casa |
| 4 | Pedido de NIS (solo con «Solo mi casa» y sin NIS guardado) | **ANDE pide el NIS para los reclamos.** Agregalo y queda guardado en Ajustes. + campo NIS (ver «Campo NIS») |
| 5 | Vista previa del mensaje, seleccionable (`selectable`) | ver «Mensaje» |
| 6 | Botón principal, ancho completo | Escribir por WhatsApp |
| 7 | Nota bajo el botón | Al abrir el chat copiamos el mensaje para que lo pegues. |
| 8 | Botón secundario, ancho completo | Llamar al 160 |
| 9 | Dos botones chicos en fila | Copiar mensaje · Compartir |
| 10 | Nota al pie | LuzAlerts no está afiliado a la ANDE. |

### Selector «Toda la cuadra» / «Solo mi casa»

- Valor inicial: «Toda la cuadra» si `confirmation_count >= 2`; si no, «Solo mi casa».
- Cambia una sola línea del mensaje y decide si va el NIS (abajo).
- Íconos: dos casas para «Toda la cuadra», una casa (`House`) para «Solo mi casa».
- Activo: fondo `DS.amber`, texto `DS.ink`, peso 800. Inactivo: transparente, texto `DS.textMid`, peso 600.
- Accesibilidad: grupo `radiogroup`, cada opción `radio` con `checked`.

### Mensaje

```
Buenas. Quiero reportar falta de energía eléctrica.

📍 Dirección: {dirección}
🗺️ Ubicación: https://maps.google.com/?q={lat},{lng}
🕒 Sin luz desde {cuándo}
🔢 NIS: {nis}
{alcance}

¿Me pasan el número de reclamo, por favor? Gracias.
```

Reglas por línea:

- **Dirección**: `{calle} {número}`, `barrio {barrio}`, `{ciudad}`, separados por coma y
  saltando lo vacío. Ejemplo: `Avda. Mcal. López 1234, barrio Villa Morra, Asunción`;
  solo ciudad: `Luque`. Sin departamento. Si no hay nada, **la línea no va** (no se
  escribe «Dirección no especificada»).
- **Ubicación**: `report.latitude` y `report.longitude` con 6 decimales y punto
  (`toFixed(6)`). Siempre va.
- **Cuándo**: `report.created_at` (parsear con `parseApiDate`) en hora de Paraguay
  (`America/Asuncion`), 24 h:
  - mismo día → `hoy a las 19:15`
  - día anterior → `ayer a las 23:05`
  - antes → `el 12/11 a las 08:40` (`dd/mm`)
- **NIS**: solo si el selector está en «Solo mi casa» **y** hay un NIS válido (7 dígitos)
  guardado. Con «Toda la cuadra» nunca va: el NIS es de la casa, no de la cuadra.
- **Alcance**: `🏘️ Se cortó en toda la cuadra.` o `🏠 Por ahora solo en mi casa.`

El armado del mensaje va en un módulo puro (`mobile/src/ande/claimMessage.ts`) que
recibe el reporte, el alcance, el NIS y la fecha de «ahora», para poder probarlo
sin la pantalla. La lógica del mockup ya está escrita y se puede portar casi igual
(`buildMessage` del canvas).

### Acciones

- **Escribir por WhatsApp** (primario: fondo `DS.amber`, texto `DS.ink`, 800, alto 56,
  radio 12, ícono `MessageCircle`): primero copia el mensaje al portapapeles, después
  abre `https://wa.me/595962160160` con `Linking.openURL`, **sin texto precargado**
  (el bot es de botones: el texto se pega recién con el operador).
- **Llamar al 160** (secundario: borde `DS.border`, fondo `DS.surface`, texto `DS.text`,
  700, alto 52, ícono `Phone`): `Linking.openURL('tel:160')`. Abre el teléfono con el
  número ya marcado; la llamada la inicia la persona.
- **Copiar mensaje** (chico, alto 44, borde `DS.border`, texto `DS.textMid`, ícono
  `Copy`): copia el mensaje. Durante 2,5 s pasa a **Copiado** con ícono `Check`, borde
  `rgba(74,222,128,0.5)`, fondo `rgba(34,197,94,0.14)`, texto `DS.greenLight`, y vuelve
  solo. «Escribir por WhatsApp» también dispara este estado.
- **Compartir** (chico, igual que Copiar sin estado): `Share.share({ message })`, la hoja
  del sistema.
- Portapapeles: hace falta `expo-clipboard` (hoy no está en `mobile/package.json`).
  Funciona en Android y en la PWA de iPhone.

### Estilo de la tarjeta

Fondo `DS.surface`, borde 1 px `DS.border`, radio 12, padding 16, separación entre
elementos 12. Vista previa: fondo `DS.bg`, borde `DS.border`, radio 10, padding 12×14,
texto 13/19 `DS.text`, cortar palabras largas (el enlace del mapa se parte). Notas: 12 px
`DS.textMuted`, centradas.

---

## Campo NIS (se usa en la tarjeta, en Ajustes y en el onboarding)

- Teclado numérico (`keyboardType="number-pad"`, `inputMode="numeric"` en web).
- Solo dígitos, **máximo 7**. Al escribir o pegar se descarta todo lo que no sea dígito
  y se corta en 7: `NIS: 1.234.567` → `1234567`. No usar `maxLength` (cortaría el texto
  pegado antes de limpiarlo).
- Se guarda como **texto**, no como número (no perder un cero inicial).
- Debajo, contador `{n} de 7 dígitos` (12 px, `DS.textMuted`).
- Error: si la persona sale del campo con 1 a 6 dígitos, borde y texto en
  `DS.redLight` y el texto pasa a `El NIS tiene 7 dígitos. Lo encontrás arriba en tu factura de ANDE.`
- **Guardar** (fondo `DS.amber`, texto `DS.ink`, 800, alto 48) está deshabilitado
  (opacidad 0,55) hasta que haya exactamente 7 dígitos.
- Placeholder: `Número de NIS`. Etiqueta accesible: `Número de NIS`.

En la tarjeta, al guardar: el NIS se guarda en el mismo lugar que Ajustes, el pedido
desaparece y la línea `🔢 NIS` aparece enseguida en la vista previa.

Capturas: [05](reclamo-ande/05-tarjeta-casa-sin-nis.png),
[06 — error](reclamo-ande/06-tarjeta-nis-incompleto.png).

---

## 2. Ajustes → «Mis lugares» → «Mi NIS de ANDE»

Archivo: `mobile/app/(tabs)/settings.tsx`.

- Fila nueva después de «Mi zona» y «Mis zonas». Ícono `Hash`, `DS.textMuted`.
- Título: `Mi NIS de ANDE`. Subtítulo: el NIS guardado, o `Opcional. Está en tu factura de ANDE`.
- A la derecha, enlace (`styles.link`): `Agregar` sin NIS, `Cambiar` con NIS, `Cerrar`
  con el panel abierto.
- Al tocar la fila se abre debajo un panel igual al de «Mi zona» (`styles.zonePanel`)
  con el campo NIS. Al guardar se cierra.
- **Borrar**: vaciar el campo y tocar Guardar borra el NIS (en este caso Guardar se
  habilita con el campo vacío si había un NIS guardado).
- Almacenamiento: `AsyncStorage`, clave `@luzalerts_ande_nis`. Agregarla a
  `LOCAL_DATA_KEYS` para que «Eliminar mis datos» la borre.

Capturas: [10](reclamo-ande/10-ajustes-nis-agregar.png),
[11](reclamo-ande/11-ajustes-nis-abierto.png),
[12 — error](reclamo-ande/12-ajustes-nis-error.png),
[13](reclamo-ande/13-ajustes-nis-cambiar.png).

---

## 3. Onboarding: slide «Reclamá a la ANDE»

Archivo: `mobile/app/onboarding.tsx`. Slide nuevo con `key: 'ande'`, **entre `share` y
`notifications`**: el onboarding pasa de 6 a 7 slides y «Notificaciones» queda último.

- Título: `Reclamá a la ANDE\nen un toque`
- Texto: `Te armamos el mensaje con tu ubicación y la hora del corte. Escribile por WhatsApp o llamá al 160.`
- Ilustración: burbuja de chat de WhatsApp con «ANDE · 0962 160 160» y un mensaje de
  ejemplo (como el slide `share`). En la línea `🔢 NIS:` se ve `•••••••` hasta que haya
  7 dígitos; después, el número en `DS.amber`.
- Debajo: etiqueta `TU NIS (OPCIONAL)`, texto `ANDE lo pide para los reclamos. Está arriba en tu factura y queda guardado solo en tu teléfono.` y el campo NIS **sin botón Guardar**.
- Botón principal: `Siguiente` con el campo vacío; `Guardar y seguir` con 7 dígitos
  (guarda y avanza); deshabilitado con 1 a 6 dígitos.
- Abajo: `Saltar`, como en los demás slides.

Capturas: [14](reclamo-ande/14-onboarding-nis.png),
[15](reclamo-ande/15-onboarding-nis-cargado.png).

---

## Tokens

Todo color sale de `DS` (`mobile/src/components/DesignSystem.tsx`):

| En el diseño | Token |
|---|---|
| `#0F172A` fondo de pantalla / texto sobre ámbar | `DS.bg` / `DS.ink` |
| `#1E293B` tarjeta | `DS.surface` |
| `#334155` bordes | `DS.border` |
| `#FBBF24` acento | `DS.amber` |
| `#F8FAFC` / `#CBD5E1` / `#94A3B8` texto | `DS.text` / `DS.textMid` / `DS.textMuted` |
| `#4ADE80` copiado | `DS.greenLight` |
| `#F87171` error | `DS.redLight` |

Los únicos valores sueltos son los fondos translúcidos que ya figuran arriba.

## Capturas de cada estado de la tarjeta

| Estado | Captura |
|---|---|
| Toda la cuadra, dirección larga (sin NIS en el mensaje) | [04](reclamo-ande/04-tarjeta-cuadra.png) |
| Solo mi casa, sin NIS, solo ciudad (pide el NIS) | [05](reclamo-ande/05-tarjeta-casa-sin-nis.png) |
| Solo mi casa, NIS incompleto (error) | [06](reclamo-ande/06-tarjeta-nis-incompleto.png) |
| Copiado | [07](reclamo-ande/07-tarjeta-copiado.png) |
| Sin dirección, «ayer a las 23:05» | [08](reclamo-ande/08-tarjeta-sin-direccion.png) |
| Solo mi casa con NIS, «el 12/11 a las 08:40» | [09](reclamo-ande/09-tarjeta-casa-con-nis.png) |

## Criterios de aceptación

- [ ] La tarjeta aparece solo para el autor o quien confirmó, y solo con el reporte abierto.
- [ ] El selector arranca en «Toda la cuadra» con 2 o más confirmaciones; si no, en «Solo mi casa».
- [ ] El mensaje coincide letra por letra con la plantilla; sin dirección no hay línea 📍.
- [ ] «hoy», «ayer» y «el dd/mm» se calculan en hora de Paraguay, aunque el teléfono esté en otra zona.
- [ ] La línea 🔢 aparece solo con «Solo mi casa» y un NIS de 7 dígitos.
- [ ] Con «Solo mi casa» y sin NIS se muestra el pedido con el campo; al guardar desaparece y el NIS entra al mensaje.
- [ ] Pegar `NIS: 1.234.567` deja `1234567`; no se pueden escribir más de 7 dígitos.
- [ ] Guardar está deshabilitado con 1 a 6 dígitos y el error aparece al salir del campo.
- [ ] «Escribir por WhatsApp» copia el mensaje y abre `wa.me/595962160160` sin texto.
- [ ] «Llamar al 160» abre el teléfono con el 160 marcado, sin llamar solo.
- [ ] «Copiado» dura 2,5 s y vuelve a «Copiar mensaje».
- [ ] El NIS se guarda en `@luzalerts_ande_nis`, se ve en Ajustes y «Eliminar mis datos» lo borra.
- [ ] El NIS nunca se manda al backend.
- [ ] El onboarding tiene 7 slides; el nuevo va antes de «Notificaciones».
- [ ] Todo el texto en español con voseo, sin «tú».
- [ ] Funciona en el APK de Android y en la PWA de iPhone.
