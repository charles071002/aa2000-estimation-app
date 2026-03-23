import type { FireProtectionSurveyData } from "../types";

/**
 * Mean-average Fire Protection pricing (PHP) for PH market.
 */
export const FIRE_PROTECTION_MEAN = {
  EXTINGUISHER_ABC: 2000,
  EXTINGUISHER_CO2: 9000,
  EXTINGUISHER_WATER: 1500,
  EXTINGUISHER_FOAM: 2200,
  EXTINGUISHER_K_CLASS: 25500,

  HOSE_REEL_SET_30M: 21000,
  FIRE_BLANKET: 519,
  EMERGENCY_LIGHT: 1800,
  EXIT_SIGN: 1500,

  SPRINKLER_HEAD: 632,
  PIPE_GI_PER_M: 450,
  PIPE_BLACK_STEEL_PER_M: 450,
  PIPE_CPVC_PER_M: 250,
  PIPE_OTHER_PER_M: 350,

  SUPPRESSION_BASE_TOTAL_FLOODING: 250000,
  SUPPRESSION_BASE_LOCAL_APPLICATION: 150000,
  SUPPRESSION_PER_NOZZLE: 12000,

  FIRE_CABLE_METER: 85,
} as const;

export interface FireProtectionMeanCostResult {
  equipment: number;
  cableMeters: number;
  cablesCost: number;
}

export function computeFireProtectionMeanCosts(
  fpData: FireProtectionSurveyData,
): FireProtectionMeanCostResult {
  const FP = FIRE_PROTECTION_MEAN;
  const units = Array.isArray(fpData?.protectionUnits) ? fpData.protectionUnits : [];

  const getExtinguisherUnitPrice = (t: string) => {
    switch (t) {
      case "ABC":
        return FP.EXTINGUISHER_ABC;
      case "CO2":
        return FP.EXTINGUISHER_CO2;
      case "Water":
        return FP.EXTINGUISHER_WATER;
      case "Foam":
        return FP.EXTINGUISHER_FOAM;
      case "K-Class":
        return FP.EXTINGUISHER_K_CLASS;
      default:
        return FP.EXTINGUISHER_ABC;
    }
  };

  const getPipeRate = (mat: string) => {
    switch (mat) {
      case "GI":
        return FP.PIPE_GI_PER_M;
      case "Black Steel":
        return FP.PIPE_BLACK_STEEL_PER_M;
      case "CPVC":
        return FP.PIPE_CPVC_PER_M;
      case "Other":
        return FP.PIPE_OTHER_PER_M;
      default:
        return FP.PIPE_GI_PER_M;
    }
  };

  let equipment = 0;
  units.forEach((u: any) => {
    const systems: string[] = Array.isArray(u?.scope?.systems) ? u.scope.systems : [];

    if (systems.includes("Portable")) {
      const fe = u.fireExtinguisher;
      if (fe?.quantity) {
        equipment += (Number(fe.quantity) || 0) * getExtinguisherUnitPrice(String(fe.type || "ABC"));
      }

      const hose = u.fireHoseReel;
      if (hose?.quantity) {
        equipment += (Number(hose.quantity) || 0) * FP.HOSE_REEL_SET_30M;
      }

      const fb = u.fireBlanket;
      if (fb?.quantity) {
        equipment += (Number(fb.quantity) || 0) * FP.FIRE_BLANKET;
      }

      const el = u.emergencyLighting;
      if (el?.present) {
        equipment += FP.EMERGENCY_LIGHT;
      }

      const ee = u.exitEvacuation;
      if (ee?.exitSignsQuantity) {
        equipment += (Number(ee.exitSignsQuantity) || 0) * FP.EXIT_SIGN;
      }
    }

    if (systems.includes("Sprinkler")) {
      const pipeLen = Number(u?.sprinkler?.pipeLength) || 0;
      const mat = String(u?.sprinkler?.pipeMaterial || "");
      equipment += Math.max(0, pipeLen) * getPipeRate(mat);
      if (pipeLen > 0) {
        equipment += Math.max(1, Math.round(pipeLen / 3)) * FP.SPRINKLER_HEAD;
      }
    }

    if (systems.includes("Suppression")) {
      const coverage = String(u?.suppression?.coverageType || "");
      const base =
        coverage === "Total Flooding"
          ? FP.SUPPRESSION_BASE_TOTAL_FLOODING
          : FP.SUPPRESSION_BASE_LOCAL_APPLICATION;
      const nozzles = Number(u?.suppression?.nozzleCount) || 0;
      let unitCost = base + Math.max(0, nozzles) * FP.SUPPRESSION_PER_NOZZLE;
      const seal = String(u?.suppression?.sealingCondition || "");
      if (seal === "Fair") unitCost *= 1.1;
      else if (seal === "Poor") unitCost *= 1.2;
      equipment += unitCost;
    }
  });

  const cableMeters = Number((fpData as any)?.infrastructure?.cableLength) || 0;
  const cablesCost = cableMeters * FP.FIRE_CABLE_METER;

  return { equipment, cableMeters, cablesCost };
}
