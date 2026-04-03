/**
 * Feature toggles — flip to `true` to enable before release.
 */
export const FEATURES = {
  /**
   * "Reportar a ANDE por WhatsApp" button on the outage detail screen.
   * Disabled in beta — enable once ANDE WhatsApp bot number is confirmed.
   */
  WHATSAPP_ANDE_BOT: false,
} as const;

/** WhatsApp deep-link for the ANDE bot. Replace with real number before enabling. */
export const ANDE_WHATSAPP_NUMBER = '+595XXXXXXXXX'; // TODO: confirm ANDE bot number
