# Política de Privacidad — LuzAlerts

**Última actualización:** 27 de abril de 2026

LuzAlerts ("la aplicación", "nosotros") es una aplicación móvil gratuita destinada a informar a la ciudadanía paraguaya sobre cortes de energía eléctrica programados y no programados publicados por la ANDE (Administración Nacional de Electricidad). La presente política describe qué datos recopilamos, con qué finalidad, con quién los compartimos y qué derechos tiene usted como usuario.

LuzAlerts es un proyecto independiente sin fines de lucro. **No estamos afiliados, asociados ni autorizados por la ANDE.** La información mostrada proviene de fuentes públicas publicadas por la ANDE en su sitio web oficial.

---

## 1. Responsable del tratamiento

- **Responsable:** Maxim Voronin (persona física)
- **Correo de contacto:** maxim.voronin2@gmail.com
- **País de operación:** Paraguay (con servidores alojados en la Unión Europea)

---

## 2. Datos que recopilamos

LuzAlerts es una aplicación **anónima**: no le pedimos nombre, correo electrónico, número de teléfono, documento de identidad ni ninguna otra información personal directamente identificable.

Los únicos datos que la aplicación recopila y transmite a nuestros servidores son:

| Dato | Cómo se obtiene | Finalidad |
|------|-----------------|-----------|
| **Identificador anónimo del dispositivo** (`device_id`) | UUID generado aleatoriamente en su dispositivo la primera vez que abre la aplicación. No corresponde al IMEI, MAC, Android ID ni al identificador publicitario. | Distinguir su dispositivo de otros para asociarle suscripciones y reportes. |
| **Coordenadas geográficas aproximadas** (latitud/longitud) | Servicio de ubicación del sistema operativo, previa autorización explícita del usuario. | Mostrar cortes cercanos en el mapa y enviar notificaciones cuando un corte ocurre dentro de un radio aproximado de 5 km. |
| **Token de notificaciones push** (Expo Push Token) | Generado por el SDK de Expo cuando el usuario autoriza notificaciones. | Entregarle alertas sobre cortes en su zona. |
| **Reportes "no hay luz"** | Cuando el usuario presiona voluntariamente el botón "Sin luz" en la aplicación. Incluye ubicación aproximada y marca temporal. | Confirmación colaborativa de cortes (un reporte se valida cuando coinciden 3 o más usuarios dentro de 500 m). |
| **Comentarios** | Texto que el usuario decide publicar voluntariamente sobre un corte. | Comunicación pública entre usuarios afectados por un mismo corte. |

### Datos que NO recopilamos

- Nombre, apellido, correo, teléfono, documento de identidad ni datos biométricos.
- Identificadores publicitarios (Advertising ID, IDFA).
- Lista de contactos, calendario, fotos, archivos ni historial de navegación.
- Lista de aplicaciones instaladas.
- Datos financieros ni de tarjetas de crédito (la aplicación es gratuita).

---

## 3. Base legal

El tratamiento de los datos se basa en:

- **Consentimiento del usuario**, otorgado expresamente al aceptar los permisos de ubicación y notificaciones durante el proceso de bienvenida (onboarding) de la aplicación.
- **Interés legítimo** en proveer el servicio informativo solicitado.

El usuario puede retirar su consentimiento en cualquier momento revocando los permisos desde los ajustes del sistema operativo, o solicitando la eliminación de sus datos (ver sección 7).

---

## 4. Compartición con terceros

Para que la aplicación funcione, transmitimos datos a los siguientes proveedores:

| Proveedor | Datos transmitidos | Finalidad |
|-----------|--------------------|-----------|
| **Expo Push Service** (Expo, Inc., Estados Unidos) | Token de notificaciones + contenido del mensaje | Entrega de notificaciones push a su dispositivo. |
| **Google Firebase Cloud Messaging (FCM)** (Google LLC) | Token + payload de notificación | Entrega final de la notificación al dispositivo Android. |
| **Google Maps SDK** (Google LLC, integrado en el dispositivo Android) | Datos de uso del mapa según las políticas de Google | Renderizar el mapa interactivo dentro de la aplicación. |

**No vendemos sus datos. No los compartimos con anunciantes, brokers de datos ni con terceros con fines comerciales.**

No transmitimos datos a la ANDE ni a ninguna otra entidad pública o privada paraguaya.

---

## 5. Almacenamiento y retención

- Los datos se almacenan en una base de datos PostgreSQL alojada en servidores ubicados en la **Unión Europea**.
- La conexión entre la aplicación y nuestros servidores está **cifrada mediante HTTPS (TLS)**.
- Conservamos sus datos mientras usted utilice la aplicación. Si solicita la eliminación o desinstala la aplicación y permanece inactivo durante 12 meses, sus datos asociados (`device_id`, ubicación, token push) se eliminan automáticamente.
- Los reportes y comentarios pueden permanecer en forma anonimizada con fines estadísticos e históricos.

---

## 6. Seguridad

Aplicamos medidas razonables para proteger sus datos:

- Comunicaciones cifradas (HTTPS/TLS) entre el cliente móvil y nuestro servidor.
- Acceso administrativo a la base de datos protegido por clave secreta (`X-Admin-Key`).
- Servidor con firewall que limita el acceso a los puertos públicos estrictamente necesarios.

Ningún sistema es absolutamente seguro. En caso de incidente que afecte sus datos, lo comunicaremos a través de la aplicación y/o de los canales oficiales del proyecto.

---

## 7. Sus derechos

Usted tiene derecho a:

- **Acceder** a la información que tenemos asociada a su `device_id`.
- **Rectificar** datos incorrectos.
- **Solicitar la eliminación** de sus datos.
- **Oponerse al tratamiento** o **retirar su consentimiento**.

Para ejercer cualquiera de estos derechos, escríbanos a **maxim.voronin2@gmail.com** indicando su `device_id` (visible en los ajustes de la aplicación). Responderemos en un plazo razonable, no mayor a 30 días.

Adicionalmente, desinstalar la aplicación detiene cualquier nuevo procesamiento de sus datos por parte de la aplicación.

---

## 8. Menores de edad

La aplicación no está dirigida a menores de 13 años. No recopilamos a sabiendas datos de menores. Si usted es padre, madre o tutor y considera que un menor nos ha proporcionado datos, contáctenos para eliminarlos.

---

## 9. Cambios a esta política

Podemos actualizar esta política. La fecha en la parte superior indica la última modificación. Cambios sustanciales serán notificados a través de la aplicación o de la página oficial del proyecto. El uso continuado de la aplicación después de una modificación implica la aceptación de los términos actualizados.

---

## 10. Legislación aplicable

Esta política se rige por las leyes de la República del Paraguay, en particular las disposiciones constitucionales sobre protección a la intimidad (artículo 33 de la Constitución Nacional).

Cualquier controversia se someterá a la jurisdicción de los tribunales competentes de la ciudad de Asunción.

---

## 11. Contacto

Para preguntas sobre esta política o sobre el tratamiento de sus datos:

**Correo:** maxim.voronin2@gmail.com
