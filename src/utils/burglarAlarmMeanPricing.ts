import type { BurglarAlarmSurveyData } from "../types";

/**
 * Mean-average Burglar Alarm pricing (PHP) for the Philippines market.
 *
 * Research sources (March 2025):
 * - VMIDirect, Lasco, Alarmnet, Guard-All, Hikvision PH, Digitalhome.ph,
 *   MegaOne, Circuitrocks, Lazada PH, Galleon PH.
 */

export const BURGLAR_ALARM_MEAN = {
  // Sensors (by survey type)
  PIR: 1000,
  DOOR_CONTACT: 800,
  GLASS_BREAK: 2000,
  VIBRATION: 1000,
  PANIC_BUTTON: 1000,
  SENSOR_OTHER: 1000,

  CONTROL_PANEL: 5500,
  KEYPAD: 3800,
  SIREN: 600,
  BATTERY_7AH: 1200,
  CABLE_PER_METER: 55,
} as const;

export interface BurglarAlarmMeanCostResult {
  equipment: number;
  cableMeters: number;
  cablesCost: number;
}

function getSensorUnitPrice(sensorType: string): number {
  const t = String(sensorType || "").trim();
  if (/^PIR$/i.test(t)) return BURGLAR_ALARM_MEAN.PIR;
  if (/door\s*contact/i.test(t)) return BURGLAR_ALARM_MEAN.DOOR_CONTACT;
  if (/glass\s*break/i.test(t)) return BURGLAR_ALARM_MEAN.GLASS_BREAK;
  if (/vibration/i.test(t)) return BURGLAR_ALARM_MEAN.VIBRATION;
  if (/panic/i.test(t)) return BURGLAR_ALARM_MEAN.PANIC_BUTTON;
  return BURGLAR_ALARM_MEAN.SENSOR_OTHER;
}

/**
 * Computes Burglar Alarm equipment + cabling cost using PH mean-average pricing.
 */
export function computeBurglarAlarmMeanCosts(
  baData: BurglarAlarmSurveyData
): BurglarAlarmMeanCostResult {
  const BA = BURGLAR_ALARM_MEAN;
  const sensors = Array.isArray(baData?.sensors) ? baData.sensors : [];

  let equipment = 0;

  sensors.forEach((s) => {
    const unitPrice = getSensorUnitPrice(s.type || "Other");
    const count = Math.max(0, Number(s.count) || 0);
    equipment += unitPrice * count;
  });

  equipment += BA.CONTROL_PANEL;

  const keypads = Math.max(0, Number(baData?.controlPanel?.keypads) || 0);
  if (keypads > 0) {
    equipment += keypads * BA.KEYPAD;
  }

  const sirenIndoor = Math.max(0, Number(baData?.notification?.sirenIndoor) || 0);
  const sirenOutdoor = Math.max(0, Number(baData?.notification?.sirenOutdoor) || 0);
  equipment += (sirenIndoor + sirenOutdoor) * BA.SIREN;

  equipment += BA.BATTERY_7AH;

  const cableMeters = Math.max(0, Number(baData?.controlPanel?.estimatedCableLength) || 0);
  const cablesCost = cableMeters * BA.CABLE_PER_METER;

  return { equipment, cableMeters, cablesCost };
}
