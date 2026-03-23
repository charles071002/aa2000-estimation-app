import type { FireAlarmSurveyData } from "../types";

/**
 * Mean-average Fire Alarm pricing (PHP) for the Philippines market.
 *
 * Research sources (March 2025):
 * - TheProjectEstimate.com PH fire alarm price list (conventional detectors, panels, notification, battery)
 * - Philippine suppliers: CCTVPinoy (Asenware), Ace Electech (HST), Lazada/Shopee (panels, MCP)
 * - Belden 5220FL FPLR fire alarm cable 305m roll ~₱25,000 → ~₱82/m
 *
 * Where PH data was limited (addressable/wireless panels, multi-sensor, flame, gas),
 * mid-range industry estimates are used and marked below.
 */

export const FIRE_ALARM_MEAN = {
  // --- Detectors (conventional: TheProjectEstimate; addressable: PH/international mid-range) ---
  /** Smoke, conventional (mean of photoelectric + ionization, surface + low profile) */
  SMOKE_CONVENTIONAL: 2960,
  /** Smoke, addressable (PH/international mid-range; limited PH-specific data) */
  SMOKE_ADDRESSABLE: 2770,
  /** Heat, conventional (fixed temp / rate rise) */
  HEAT_CONVENTIONAL: 2121,
  /** Heat, addressable */
  HEAT_ADDRESSABLE: 1750,
  /** Multi-sensor (addressable-type; industry mid-range) */
  MULTI_SENSOR: 3500,
  /** Flame detector */
  FLAME: 15000,
  /** Gas detector */
  GAS: 5500,
  /** Other / unspecified detector */
  DETECTOR_OTHER: 1800,

  // --- Control panels (conventional: 2–10 zone PH list + Asenware 12-zone; addressable/wireless: mid-range) ---
  /** Conventional FACP (mean across 2/4/5/8/10/12-zone PH listings) */
  FACP_CONVENTIONAL: 29500,
  /** Addressable FACP */
  FACP_ADDRESSABLE: 72500,
  /** Wireless FACP */
  FACP_WIRELESS: 52500,

  // --- Notification devices (TheProjectEstimate + PH suppliers) ---
  BELL: 1722,
  HORN: 2250,
  STROBE: 2790,
  HORN_STROBE: 3374,
  /** Manual call point / pull station (dual action) */
  MCP: 1830,
  /** Average across bell, horn, strobe, horn/strobe for generic “notification device” */
  NOTIFICATION_AVG: 2540,

  // --- Backup & infrastructure ---
  BATTERY_7AH: 2118,
  /** Fire alarm cable (FPLR/FRL) per meter; Belden 5220FL ~₱82/m; rounded to ₱85 for consistency with other cabling */
  FIRE_CABLE_METER: 85,

  // --- Legacy/fallback keys used by estimation logic ---
  DETECTOR: 1800,
  FACP_BASE: 72500,
} as const;

export interface FireAlarmMeanCostResult {
  equipment: number;
  cableMeters: number;
  cablesCost: number;
}

/**
 * Computes Fire Alarm equipment + cabling cost using PH mean-average pricing.
 */
export function computeFireAlarmMeanCosts(faData: FireAlarmSurveyData): FireAlarmMeanCostResult {
  const FA = FIRE_ALARM_MEAN;
  const sys = faData?.systemType || "Conventional";
  const isAddr = sys === "Addressable";
  const isWireless = sys === "Wireless";

  const getDetectorPrice = (devType: string): number => {
    switch (devType) {
      case "Smoke":
        return isAddr ? FA.SMOKE_ADDRESSABLE : FA.SMOKE_CONVENTIONAL;
      case "Heat":
        return isAddr ? FA.HEAT_ADDRESSABLE : FA.HEAT_CONVENTIONAL;
      case "Multi-sensor":
        return FA.MULTI_SENSOR;
      case "Flame":
        return FA.FLAME;
      case "Gas":
        return FA.GAS;
      default:
        return FA.DETECTOR_OTHER;
    }
  };

  let equipment = 0;
  const areas = Array.isArray(faData?.detectionAreas) ? faData.detectionAreas : [];
  areas.forEach((area) => {
    (area.devices || []).forEach((dev) => {
      const n = Number(dev.count) || 0;
      equipment += getDetectorPrice(dev.type || "Other") * n;
    });
  });

  if (isWireless) equipment += FA.FACP_WIRELESS;
  else if (isAddr) equipment += FA.FACP_ADDRESSABLE;
  else equipment += FA.FACP_CONVENTIONAL;

  equipment += FA.BATTERY_7AH;

  const notifCount = Number(faData?.notification?.deviceCount) || 0;
  const mcpCount = Number(faData?.notification?.mcpCount) || 0;
  equipment += notifCount * FA.NOTIFICATION_AVG + mcpCount * FA.MCP;

  const cableMeters = Number(faData?.infrastructure?.cableLength) || 0;
  const cablesCost = cableMeters * FA.FIRE_CABLE_METER;

  return { equipment, cableMeters, cablesCost };
}
