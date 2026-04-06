import React, { useState, useEffect } from 'react';
import { Project, SurveyType, EstimationDetail, EstimationManpowerEntry, EstimationConsumableEntry, EstimationAdditionalFeeEntry, CCTVSurveyData, FireAlarmSurveyData, AccessControlSurveyData, BurglarAlarmSurveyData, FireProtectionSurveyData, OtherSurveyData } from '../types';
import axios from 'axios';
import { createEstimationDocx } from './17_BOQ';
import { computeAccessControlMeanCosts, ACCESS_CONTROL_MEAN } from '../utils/accessControlMeanPricing';
import { computeCctvMeanCosts, CCTV_MEAN } from '../utils/cctvMeanPricing';
import { computeFireAlarmMeanCosts, FIRE_ALARM_MEAN } from '../utils/fireAlarmMeanPricing';
import { computeFireProtectionMeanCosts, FIRE_PROTECTION_MEAN } from '../utils/fireProtectionMeanPricing';
import { computeBurglarAlarmMeanCosts, BURGLAR_ALARM_MEAN } from '../utils/burglarAlarmMeanPricing';
import { CONSUMABLE_DEFAULT_PRICES } from '../utils/consumableDefaultPrices';

type ManpowerEntry = EstimationManpowerEntry;
type ConsumableEntry = EstimationConsumableEntry;

const CONSUMABLE_CATEGORIES: { key: string; label: string; items: string[] }[] = [
  {
    key: 'Fastening',
    label: 'Fastening',
    items: [
      'Self-tapping screws',
      'Concrete screws',
      'Mounting screws',
      'Small mounting screws',
      'Expansion bolts',
      'Anchor bolts',
      'Expansion anchors',
      'Wall plugs / Rawl plugs',
      'Wall anchors',
      'Washers',
      'Nuts & bolts',
      'Assorted screws'
    ]
  },
  {
    key: 'Sealing & Protection',
    label: 'Sealing & Protection',
    items: [
      'Silicone sealant (weatherproof)',
      'Fire-rated silicone sealant',
      'Expanding foam',
      'Firestop foam',
      'Firestop putty',
      'Firestop sealant',
      'Teflon tape',
      'Thread sealant',
      'Pipe joint compound',
      'Gaskets',
      'O-rings',
      'Rust-proof spray',
      'Anti-rust coating'
    ]
  },
  {
    key: 'Electrical & Finishing',
    label: 'Electrical & Finishing',
    items: [
      'Electrical tape',
      'Heat shrink tubing',
      'Wire ferrules',
      'Wire connectors',
      'Terminal lugs',
      'Terminal connectors',
      'End-of-line resistor covers',
      'Cable markers / labels',
      'Zone labels',
      'Warning stickers',
      'Labels / asset tags',
      'Permanent marker',
      'Marker pens',
      'Cleaning alcohol',
      'Cleaning wipes',
      'Red touch-up paint',
      'Touch-up paint'
    ]
  },
  {
    key: 'Mounting Support',
    label: 'Mounting Support',
    items: [
      'Double-sided industrial tape',
      'Velcro straps',
      'Rubber spacers',
      'Drill bits',
      'Cutting discs',
      'Grinding discs',
      'Welding rods',
      'Lubricating oil'
    ]
  }
];

/** Mean average prices (₱) per piece (or per single unit: tube/roll/can) — Philippines market research. */

interface Props {
  project: Project;
  viewerRole?: 'TECHNICIAN' | 'ADMIN' | null;
  type: SurveyType;
  cctvData: CCTVSurveyData | null;
  faData: FireAlarmSurveyData | null;
  fpData: FireProtectionSurveyData | null;
  acData: AccessControlSurveyData | null;
  baData: BurglarAlarmSurveyData | null;
  otherData: OtherSurveyData | null;
  initialEstimation?: EstimationDetail;
  onComplete: (est: EstimationDetail) => void;
  onContinueFA: (est: EstimationDetail) => void;
  onContinueFP: (est: EstimationDetail) => void;
  onContinueCCTV: (est: EstimationDetail) => void;
  onContinueAC: (est: EstimationDetail) => void;
  onContinueBA: (est: EstimationDetail) => void;
  onContinueOther: (est: EstimationDetail) => void;
  onBack: () => void;
}

const ROLES = [
  'General Helper / Laborer',
  'Pipe Fitter / Electrician',
  'LV Installer',
  'Lead Technician / Senior Installer',
  'Programmer/Commissioning Tech',
  'Safety Officer'
];

/** Adjusted ₱/hour by role for estimation labor cost. */
const LABOR_RATE_PER_HOUR: Record<string, number> = {
  'General Helper / Laborer': 100,
  'Pipe Fitter / Electrician': 120,
  'LV Installer': 140,
  'Lead Technician / Senior Installer': 175,
  'Programmer/Commissioning Tech': 200,
  'Safety Officer': 125
};

/**
 * ESTIMATION SCREEN COMPONENT
 */
const EstimationScreen: React.FC<Props> = ({ 
  project, viewerRole, type, cctvData, faData, fpData, acData, baData, otherData,
  initialEstimation, onComplete, onContinueFA, onContinueFP, onContinueCCTV, onContinueAC, onContinueBA, onContinueOther, onBack 
}) => {
  const isTechnicianRestrictedView = viewerRole === 'TECHNICIAN';
  const canViewCosting = !isTechnicianRestrictedView;
  const canViewSensitiveClientInfo = !isTechnicianRestrictedView;

  const [costs, setCosts] = useState({
    equipment: type === SurveyType.OTHER ? (otherData?.estimatedCost || 0) : 0,
    cables: type === SurveyType.OTHER ? (otherData?.cablesCost || 0) : 0,
    labor: 0,
    additional: 0,
    materials: 0
  });

  const [laborDetails, setLaborDetails] = useState({
    days: initialEstimation?.days ?? (type === SurveyType.OTHER ? 0 : 1),
    techs: initialEstimation?.techs ?? (type === SurveyType.OTHER ? 0 : 1)
  });

  const [manpowerBreakdown, setManpowerBreakdown] = useState<ManpowerEntry[]>(() => {
    if (initialEstimation?.manpowerBreakdown?.length) return initialEstimation.manpowerBreakdown as ManpowerEntry[];
    if (initialEstimation?.days != null && initialEstimation?.techs != null)
      return [{ id: '1', role: 'Lead Technician / Senior Installer', count: initialEstimation.techs, hours: (initialEstimation.days || 1) * 8 }];
    return [{ id: '1', role: 'Lead Technician / Senior Installer', count: 1, hours: 8 }];
  });

  const [showEffortModal, setShowEffortModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManpowerEntry | null>(null);
  
  // Local string states for inputs to allow full deletion/editing
  const [inputHours, setInputHours] = useState<string>('');
  const [inputCount, setInputCount] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);

  const [consumablesList, setConsumablesList] = useState<ConsumableEntry[]>(() => initialEstimation?.consumablesList?.length ? (initialEstimation.consumablesList as ConsumableEntry[]) : []);
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [expandedConsumableCategory, setExpandedConsumableCategory] = useState<string | null>(null);
  const [consumableQuantities, setConsumableQuantities] = useState<Record<string, string>>({});
  const [editingConsumableId, setEditingConsumableId] = useState<string | null>(null);
  const [editingConsumableQty, setEditingConsumableQty] = useState<string>('');
  const [showInventoryRecountModal, setShowInventoryRecountModal] = useState(false);
  const [showAdditionalFeeModal, setShowAdditionalFeeModal] = useState(false);
  const [showSiteConstraintsModal, setShowSiteConstraintsModal] = useState(false);
  const [expandedSiteConstraintSection, setExpandedSiteConstraintSection] = useState<
    'physical' | 'electrical' | 'installation' | null
  >(null);
  const [expandedPhysicalConstraintCategory, setExpandedPhysicalConstraintCategory] = useState<
    'structure' | 'space' | 'routing' | null
  >(null);
  const [expandedElectricalConstraintCategory, setExpandedElectricalConstraintCategory] = useState<
    'availability' | 'quality' | 'backup' | 'capacity' | null
  >(null);
  const [expandedInstallationConstraintCategory, setExpandedInstallationConstraintCategory] = useState<
    'work' | 'permits' | 'access' | 'complexity' | null
  >(null);
  const [physicalConstraints, setPhysicalConstraints] = useState<{
    ceilingType: string;
    wallType: string;
    floorLevels: string;
    ceilingHeight: string;
    spaceAccessibility: '' | 'Open' | 'Tight' | 'Congested';
    obstructionsPercent: number; // 0 (No) → 100 (Yes)
    routingObstructionsPercent: number; // 0 (No) → 100 (Yes)
    mountingPoints: '' | 'Adequate' | 'Limited' | 'None';
    cablePathCondition: '' | 'Straight' | 'With bends' | 'Complex';
    distanceBetweenDevices: '' | 'Short' | 'Medium' | 'Long';
  }>({
    ceilingType: '',
    wallType: '',
    floorLevels: '',
    ceilingHeight: '',
    spaceAccessibility: '',
    obstructionsPercent: 0,
    routingObstructionsPercent: 0,
    mountingPoints: '',
    cablePathCondition: '',
    distanceBetweenDevices: '',
  });
  const [electricalConstraints, setElectricalConstraints] = useState<{
    powerSourceNearby: '' | 'Yes' | 'No';
    distanceToPowerSource: '' | 'Near' | 'Moderate' | 'Far';
    voltageType: '' | '220V' | '110V' | 'Mixed';
    powerStability: '' | 'Stable' | 'Unstable';
    upsAvailable: '' | 'Yes' | 'No';
    generatorAvailable: '' | 'Yes' | 'No';
    surgeProtectionNeeded: '' | 'Yes' | 'No';
    spareCircuitAvailable: '' | 'Yes' | 'No';
    panelAccessibilityPercent: number; // 0 (Easy) → 100 (Restricted)
  }>({
    powerSourceNearby: '',
    distanceToPowerSource: '',
    voltageType: '',
    powerStability: '',
    upsAvailable: '',
    generatorAvailable: '',
    surgeProtectionNeeded: '',
    spareCircuitAvailable: '',
    panelAccessibilityPercent: 0,
  });
  const [installationConstraints, setInstallationConstraints] = useState<{
    workingHours: '' | 'Daytime' | 'Night Shift Only' | 'Limited Hours';
    noiseRestrictions: '' | 'Yes' | 'No';
    workInterruptions: '' | 'None' | 'Occasional' | 'Frequent';
    permitRequired: '' | 'Yes' | 'No';
    safetyRequirements: '' | 'PPE Only' | 'With Safety Officer';
    siteInductionRequired: '' | 'Yes' | 'No';
    siteAccessibility: '' | 'Easy' | 'Moderate' | 'Difficult';
    elevatorAccess: '' | 'Yes' | 'No';
    stairAccessOnly: '' | 'Yes' | 'No';
    workingAtHeight: '' | 'Yes' | 'No';
    specialEquipmentNeeded: '' | 'Ladder' | 'Scaffolding' | 'Boom Lift';
    teamSizeLimitation: '' | 'Yes' | 'No';
  }>({
    workingHours: '',
    noiseRestrictions: '',
    workInterruptions: '',
    permitRequired: '',
    safetyRequirements: '',
    siteInductionRequired: '',
    siteAccessibility: '',
    elevatorAccess: '',
    stairAccessOnly: '',
    workingAtHeight: '',
    specialEquipmentNeeded: '',
    teamSizeLimitation: '',
  });
  const [siteConstraintPhysical, setSiteConstraintPhysical] = useState<string>('');
  const [siteConstraintElectrical, setSiteConstraintElectrical] = useState<string>('');
  const [siteConstraintInstallation, setSiteConstraintInstallation] = useState<string>('');
  const [additionalFees, setAdditionalFees] = useState<EstimationAdditionalFeeEntry[]>(() => initialEstimation?.additionalFees ?? []);
  const [additionalFeeType, setAdditionalFeeType] = useState<string>('Travel Fee');
  const [additionalFeeAmountInput, setAdditionalFeeAmountInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ADDITIONAL_FEE_TYPES = ['Travel Fee', 'Permit Fee', 'Special Equipment Fee', 'High-Risk Site Fee', 'After-Hours Fee', 'Re-Survey Fee'];

  const parseFirstNumber = (text: string): number | null => {
    const m = String(text || '').match(/(\d+(\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const getPhysicalImpact = () => {
    const structure = getStructureImpact();
    const space = getSpaceImpact();
    const routing = getRoutingImpact();
    if (structure.label === 'No Impact' && space.label === 'No Impact' && routing.label === 'No Impact') return noImpact();

    let score = 0;

    // Floors
    const floorsN = parseFirstNumber(physicalConstraints.floorLevels || '');
    if (floorsN != null) {
      if (floorsN >= 4) score += 2;
      else if (floorsN >= 2) score += 1;
    } else {
      const t = (physicalConstraints.floorLevels || '').toLowerCase();
      if (t.includes('multi')) score += 1;
    }

    // Ceiling height
    const chText = (physicalConstraints.ceilingHeight || '').toLowerCase();
    const chN = parseFirstNumber(chText);
    if (chN != null) {
      if (chN > 5) score += 2;
      else if (chN >= 3) score += 1;
    } else if (chText.includes('high')) score += 2;
    else if (chText.includes('medium')) score += 1;

    // Space accessibility
    if (physicalConstraints.spaceAccessibility === 'Tight') score += 1;
    else if (physicalConstraints.spaceAccessibility === 'Congested') score += 2;

    // Obstructions
    const obs = Math.round(Number(physicalConstraints.obstructionsPercent) || 0);
    if (obs >= 67) score += 2;
    else if (obs >= 34) score += 1;

    // Mounting points
    if (physicalConstraints.mountingPoints === 'Limited') score += 1;
    else if (physicalConstraints.mountingPoints === 'None') score += 2;

    // Routing difficulty
    if (physicalConstraints.cablePathCondition === 'With bends') score += 1;
    else if (physicalConstraints.cablePathCondition === 'Complex') score += 2;

    if (physicalConstraints.distanceBetweenDevices === 'Medium') score += 1;
    else if (physicalConstraints.distanceBetweenDevices === 'Long') score += 2;

    const rObs = Math.round(Number(physicalConstraints.routingObstructionsPercent) || 0);
    if (rObs >= 67) score += 2;
    else if (rObs >= 34) score += 1;

    if (score <= 4) {
      return { label: '🟢 Low Impact', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (score <= 9) {
      return { label: '🟡 Medium Impact', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    return { label: '🔴 High Impact', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
  };

  const impactFromScore = (score: number) => {
    if (score <= 1) return { label: '🟢 Low Impact', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score <= 3) return { label: '🟡 Medium Impact', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { label: '🔴 High Impact', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
  };

  const noImpact = () => ({ label: 'No Impact', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' });

  const getStructureImpact = () => {
    const hasInput =
      (physicalConstraints.floorLevels || '').trim() !== '' ||
      (physicalConstraints.ceilingType || '').trim() !== '' ||
      (physicalConstraints.ceilingHeight || '').trim() !== '' ||
      (physicalConstraints.wallType || '').trim() !== '';
    if (!hasInput) return noImpact();
    let score = 0;
    const floorsN = parseFirstNumber(physicalConstraints.floorLevels || '');
    if (floorsN != null) {
      if (floorsN >= 4) score += 2;
      else if (floorsN >= 2) score += 1;
    } else if ((physicalConstraints.floorLevels || '').toLowerCase().includes('multi')) {
      score += 1;
    }
    const chText = (physicalConstraints.ceilingHeight || '').toLowerCase();
    const chN = parseFirstNumber(chText);
    if (chN != null) {
      if (chN > 5) score += 2;
      else if (chN >= 3) score += 1;
    } else if (chText.includes('high')) score += 2;
    else if (chText.includes('medium')) score += 1;
    return impactFromScore(score);
  };

  const getSpaceImpact = () => {
    const hasInput =
      physicalConstraints.spaceAccessibility !== '' ||
      physicalConstraints.mountingPoints !== '' ||
      (Math.round(Number(physicalConstraints.obstructionsPercent) || 0) > 0);
    if (!hasInput) return noImpact();

    let score = 0;
    if (physicalConstraints.spaceAccessibility === 'Tight') score += 1;
    else if (physicalConstraints.spaceAccessibility === 'Congested') score += 2;

    const obs = Math.round(Number(physicalConstraints.obstructionsPercent) || 0);
    if (obs >= 67) score += 2;
    else if (obs >= 34) score += 1;

    if (physicalConstraints.mountingPoints === 'Limited') score += 1;
    else if (physicalConstraints.mountingPoints === 'None') score += 2;
    return impactFromScore(score);
  };

  const getRoutingImpact = () => {
    const hasInput =
      physicalConstraints.cablePathCondition !== '' ||
      physicalConstraints.distanceBetweenDevices !== '' ||
      (Math.round(Number(physicalConstraints.routingObstructionsPercent) || 0) > 0);
    if (!hasInput) return noImpact();

    let score = 0;
    if (physicalConstraints.cablePathCondition === 'With bends') score += 1;
    else if (physicalConstraints.cablePathCondition === 'Complex') score += 2;
    if (physicalConstraints.distanceBetweenDevices === 'Medium') score += 1;
    else if (physicalConstraints.distanceBetweenDevices === 'Long') score += 2;
    const rObs = Math.round(Number(physicalConstraints.routingObstructionsPercent) || 0);
    if (rObs >= 67) score += 2;
    else if (rObs >= 34) score += 1;
    return impactFromScore(score);
  };

  const getElectricalImpact = () => {
    const avail = getPowerAvailabilityImpact();
    const quality = getPowerQualityImpact();
    const backup = getBackupImpact();
    const capacity = getCapacityImpact();
    if (avail.label === 'No Impact' && quality.label === 'No Impact' && backup.label === 'No Impact' && capacity.label === 'No Impact') return noImpact();

    let score = 0;

    // Power availability
    if (electricalConstraints.powerSourceNearby === 'No') score += 2;
    else if (electricalConstraints.powerSourceNearby === 'Yes') score += 0;

    if (electricalConstraints.distanceToPowerSource === 'Moderate') score += 1;
    else if (electricalConstraints.distanceToPowerSource === 'Far') score += 2;

    // Power quality
    if (electricalConstraints.voltageType === 'Mixed') score += 1;
    if (electricalConstraints.powerStability === 'Unstable') score += 2;

    // Backup & protection
    if (electricalConstraints.upsAvailable === 'No') score += 2;
    else if (electricalConstraints.upsAvailable === 'Yes') score += 0;

    if (electricalConstraints.generatorAvailable === 'No') score += 1;
    if (electricalConstraints.surgeProtectionNeeded === 'Yes') score += 1;

    // Capacity
    if (electricalConstraints.spareCircuitAvailable === 'No') score += 2;

    const panel = Math.round(Number(electricalConstraints.panelAccessibilityPercent) || 0);
    if (panel >= 67) score += 2;
    else if (panel >= 34) score += 1;

    if (score <= 4) return { label: '🟢 Low Impact', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score <= 9) return { label: '🟡 Medium Impact', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { label: '🔴 High Impact', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
  };

  const getPowerAvailabilityImpact = () => {
    const hasInput = electricalConstraints.powerSourceNearby !== '' || electricalConstraints.distanceToPowerSource !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (electricalConstraints.powerSourceNearby === 'No') score += 2;
    if (electricalConstraints.distanceToPowerSource === 'Moderate') score += 1;
    else if (electricalConstraints.distanceToPowerSource === 'Far') score += 2;
    return impactFromScore(score);
  };

  const getPowerQualityImpact = () => {
    const hasInput = electricalConstraints.voltageType !== '' || electricalConstraints.powerStability !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (electricalConstraints.voltageType === 'Mixed') score += 1;
    if (electricalConstraints.powerStability === 'Unstable') score += 2;
    return impactFromScore(score);
  };

  const getBackupImpact = () => {
    const hasInput =
      electricalConstraints.upsAvailable !== '' ||
      electricalConstraints.generatorAvailable !== '' ||
      electricalConstraints.surgeProtectionNeeded !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (electricalConstraints.upsAvailable === 'No') score += 2;
    if (electricalConstraints.generatorAvailable === 'No') score += 1;
    if (electricalConstraints.surgeProtectionNeeded === 'Yes') score += 1;
    return impactFromScore(score);
  };

  const getCapacityImpact = () => {
    const hasInput =
      electricalConstraints.spareCircuitAvailable !== '' ||
      (Math.round(Number(electricalConstraints.panelAccessibilityPercent) || 0) > 0);
    if (!hasInput) return noImpact();

    let score = 0;
    if (electricalConstraints.spareCircuitAvailable === 'No') score += 2;
    const panel = Math.round(Number(electricalConstraints.panelAccessibilityPercent) || 0);
    if (panel >= 67) score += 2;
    else if (panel >= 34) score += 1;
    return impactFromScore(score);
  };

  const getWorkRestrictionsImpact = () => {
    const hasInput =
      installationConstraints.workingHours !== '' ||
      installationConstraints.noiseRestrictions !== '' ||
      installationConstraints.workInterruptions !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (installationConstraints.workingHours === 'Night Shift Only') score += 2;
    else if (installationConstraints.workingHours === 'Limited Hours') score += 1;
    if (installationConstraints.noiseRestrictions === 'Yes') score += 1;
    if (installationConstraints.workInterruptions === 'Frequent') score += 2;
    else if (installationConstraints.workInterruptions === 'Occasional') score += 1;
    return impactFromScore(score);
  };

  const getPermitsImpact = () => {
    const hasInput =
      installationConstraints.permitRequired !== '' ||
      installationConstraints.safetyRequirements !== '' ||
      installationConstraints.siteInductionRequired !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (installationConstraints.permitRequired === 'Yes') score += 2;
    if (installationConstraints.safetyRequirements === 'With Safety Officer') score += 1;
    if (installationConstraints.siteInductionRequired === 'Yes') score += 1;
    return impactFromScore(score);
  };

  const getAccessibilityImpact = () => {
    const hasInput =
      installationConstraints.siteAccessibility !== '' ||
      installationConstraints.elevatorAccess !== '' ||
      installationConstraints.stairAccessOnly !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (installationConstraints.siteAccessibility === 'Difficult') score += 2;
    else if (installationConstraints.siteAccessibility === 'Moderate') score += 1;
    if (installationConstraints.elevatorAccess === 'No') score += 1;
    if (installationConstraints.stairAccessOnly === 'Yes') score += 2;
    return impactFromScore(score);
  };

  const getInstallationComplexityImpact = () => {
    const hasInput =
      installationConstraints.workingAtHeight !== '' ||
      installationConstraints.specialEquipmentNeeded !== '' ||
      installationConstraints.teamSizeLimitation !== '';
    if (!hasInput) return noImpact();

    let score = 0;
    if (installationConstraints.workingAtHeight === 'Yes') score += 2;
    if (installationConstraints.specialEquipmentNeeded === 'Boom Lift') score += 2;
    else if (installationConstraints.specialEquipmentNeeded === 'Scaffolding') score += 1;
    if (installationConstraints.teamSizeLimitation === 'Yes') score += 2;
    return impactFromScore(score);
  };

  const getInstallationImpact = () => {
    const work = getWorkRestrictionsImpact();
    const permits = getPermitsImpact();
    const access = getAccessibilityImpact();
    const complexity = getInstallationComplexityImpact();
    if (work.label === 'No Impact' && permits.label === 'No Impact' && access.label === 'No Impact' && complexity.label === 'No Impact') return noImpact();

    const scoreFromLabel = (l: string) => {
      if (l.includes('High')) return 3;
      if (l.includes('Medium')) return 2;
      if (l.includes('No Impact')) return 0;
      return 1;
    };
    const total = scoreFromLabel(work.label) + scoreFromLabel(permits.label) + scoreFromLabel(access.label) + scoreFromLabel(complexity.label);
    if (total <= 4) return { label: '🟢 Low Impact', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (total <= 8) return { label: '🟡 Medium Impact', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { label: '🔴 High Impact', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
  };

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '') : '';
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) ? (import.meta.env.VITE_API_KEY as string) : '';

  // Keep legacy `siteConstraintPhysical` string in sync (useful for summary/export later).
  useEffect(() => {
    const parts: string[] = [];
    const push = (label: string, value: string) => {
      if (!value) return;
      parts.push(`${label}: ${value}`);
    };
    push('Ceiling', physicalConstraints.ceilingType);
    push('Wall', physicalConstraints.wallType);
    push('Floors', physicalConstraints.floorLevels);
    push('Height', physicalConstraints.ceilingHeight);
    push('Access', physicalConstraints.spaceAccessibility);
    push('Obstructions', `${Math.round(physicalConstraints.obstructionsPercent)}%`);
    push('Mounting', physicalConstraints.mountingPoints);
    push('Cable path', physicalConstraints.cablePathCondition);
    push('Distance', physicalConstraints.distanceBetweenDevices);
    push('Routing obstructions', `${Math.round(physicalConstraints.routingObstructionsPercent)}%`);
    const next = parts.join(' • ');
    setSiteConstraintPhysical((prev) => (prev === next ? prev : next));
  }, [physicalConstraints]);

  // Keep legacy `siteConstraintElectrical` string in sync (useful for summary/export later).
  useEffect(() => {
    const parts: string[] = [];
    const push = (label: string, value: string) => {
      if (!value) return;
      parts.push(`${label}: ${value}`);
    };
    push('Power nearby', electricalConstraints.powerSourceNearby);
    push('Power distance', electricalConstraints.distanceToPowerSource);
    push('Voltage', electricalConstraints.voltageType);
    push('Stability', electricalConstraints.powerStability);
    push('UPS', electricalConstraints.upsAvailable);
    push('Generator', electricalConstraints.generatorAvailable);
    push('Surge', electricalConstraints.surgeProtectionNeeded);
    push('Spare circuit', electricalConstraints.spareCircuitAvailable);
    push('Panel access', `${Math.round(electricalConstraints.panelAccessibilityPercent)}%`);
    const next = parts.join(' • ');
    setSiteConstraintElectrical((prev) => (prev === next ? prev : next));
  }, [electricalConstraints]);

  // Auto-fill Electrical → UPS Available based on the survey (when available).
  useEffect(() => {
    if (!showSiteConstraintsModal) return;
    if (electricalConstraints.upsAvailable) return; // don't override user choice

    const upsFromSurvey = (() => {
      if (type === SurveyType.CCTV) return cctvData?.controlRoom?.upsRequired;
      if (type === SurveyType.FIRE_ALARM) return faData?.controlPanel?.upsRequired;
      if (type === SurveyType.ACCESS_CONTROL) return acData?.controller?.upsRequired;
      // Closest equivalent in Fire Protection is "battery required" for alarm core.
      if (type === SurveyType.FIRE_PROTECTION) return (fpData as any)?.alarmCore?.batteryRequired;
      return undefined;
    })();

    if (upsFromSurvey === undefined) return;
    setElectricalConstraints((prev) => ({ ...prev, upsAvailable: upsFromSurvey ? 'Yes' : 'No' }));
  }, [showSiteConstraintsModal, electricalConstraints.upsAvailable, type, cctvData, faData, acData, fpData]);

  // Keep legacy `siteConstraintInstallation` string in sync (useful for summary/export later).
  useEffect(() => {
    const parts: string[] = [];
    const push = (label: string, value: string) => {
      if (!value) return;
      parts.push(`${label}: ${value}`);
    };
    push('Hours', installationConstraints.workingHours);
    push('Noise', installationConstraints.noiseRestrictions);
    push('Interruptions', installationConstraints.workInterruptions);
    push('Permit', installationConstraints.permitRequired);
    push('Safety', installationConstraints.safetyRequirements);
    push('Induction', installationConstraints.siteInductionRequired);
    push('Access', installationConstraints.siteAccessibility);
    push('Elevator', installationConstraints.elevatorAccess);
    push('Stairs only', installationConstraints.stairAccessOnly);
    push('Height work', installationConstraints.workingAtHeight);
    push('Equipment', installationConstraints.specialEquipmentNeeded);
    push('Team limit', installationConstraints.teamSizeLimitation);
    const next = parts.join(' • ');
    setSiteConstraintInstallation((prev) => (prev === next ? prev : next));
  }, [installationConstraints]);

  // Sync Physical → Floor Levels based on survey's building floors (beginning of each survey).
  useEffect(() => {
    if (!showSiteConstraintsModal) return;

    const floorsFromSurvey = (() => {
      if (type === SurveyType.CCTV) return Number(cctvData?.buildingInfo?.floors);
      if (type === SurveyType.FIRE_ALARM) return Number(faData?.buildingInfo?.floors);
      if (type === SurveyType.FIRE_PROTECTION) return Number(fpData?.buildingInfo?.floors);
      if (type === SurveyType.ACCESS_CONTROL) return Number(acData?.buildingInfo?.floors);
      if (type === SurveyType.BURGLAR_ALARM) return Number(baData?.buildingInfo?.floors);
      if (type === SurveyType.OTHER) return Number(otherData?.buildingInfo?.floors);
      return NaN;
    })();

    if (!Number.isFinite(floorsFromSurvey) || floorsFromSurvey <= 0) return;

    const autoText = `${floorsFromSurvey} floor${floorsFromSurvey === 1 ? '' : 's'}`;
    // Only auto-fill when empty, or when it was previously auto-filled by the old logic.
    if (
      physicalConstraints.floorLevels &&
      physicalConstraints.floorLevels.trim() !== '' &&
      !['Single', 'Multi-floor'].includes(physicalConstraints.floorLevels.trim())
    ) {
      return;
    }
    setPhysicalConstraints((prev) => ({ ...prev, floorLevels: autoText }));
  }, [
    showSiteConstraintsModal,
    physicalConstraints.floorLevels,
    type,
    cctvData,
    faData,
    fpData,
    acData,
    baData,
    otherData,
  ]);

  // Sync Physical → Structure/Environment text fields from survey inputs (when available).
  useEffect(() => {
    if (!showSiteConstraintsModal) return;

    const pickMostCommon = (values: Array<string | undefined | null>): string => {
      const cleaned = values
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean);
      if (cleaned.length === 0) return '';
      const counts = new Map<string, number>();
      cleaned.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
      let best = cleaned[0];
      let bestCount = counts.get(best) || 0;
      counts.forEach((c, v) => {
        if (c > bestCount) {
          best = v;
          bestCount = c;
        }
      });
      return best;
    };

    const ceilingTypeFromSurvey = (() => {
      if (type === SurveyType.FIRE_PROTECTION) {
        const v = (fpData as any)?.siteConstraints?.ceilingType;
        return v ? String(v) : '';
      }
      if (type === SurveyType.FIRE_ALARM) {
        const areas = Array.isArray((faData as any)?.detectionAreas) ? (faData as any).detectionAreas : [];
        return pickMostCommon(areas.map((a: any) => a?.ceilingType));
      }
      if (type === SurveyType.OTHER) {
        const v = (otherData as any)?.ceilingType;
        return v ? String(v) : '';
      }
      return '';
    })();

    const wallTypeFromSurvey = (() => {
      if (type === SurveyType.CCTV) {
        const v = (cctvData as any)?.infrastructure?.wallType;
        return v ? String(v) : '';
      }
      if (type === SurveyType.FIRE_ALARM) {
        const v = (faData as any)?.infrastructure?.wallType;
        return v ? String(v) : '';
      }
      if (type === SurveyType.BURGLAR_ALARM) {
        const sensors = Array.isArray((baData as any)?.sensors) ? (baData as any).sensors : [];
        return pickMostCommon(sensors.map((s: any) => s?.wallType));
      }
      if (type === SurveyType.ACCESS_CONTROL) {
        const doors = Array.isArray((acData as any)?.doors) ? (acData as any).doors : [];
        return pickMostCommon(doors.map((d: any) => d?.wallType));
      }
      return '';
    })();

    const ceilingHeightFromSurvey = (() => {
      if (type === SurveyType.FIRE_PROTECTION) {
        const raw = Number((fpData as any)?.siteConstraints?.ceilingHeight);
        if (!Number.isFinite(raw) || raw <= 0) return '';
        return `${raw} m`;
      }
      if (type === SurveyType.FIRE_ALARM) {
        const areas = Array.isArray((faData as any)?.detectionAreas) ? (faData as any).detectionAreas : [];
        const heights = areas
          .map((a: any) => Number(a?.ceilingHeight))
          .filter((n: number) => Number.isFinite(n) && n > 0);
        if (heights.length === 0) return '';
        // use most common rounded to 0.1m
        const rounded = heights.map((h: number) => (Math.round(h * 10) / 10).toFixed(1));
        const common = pickMostCommon(rounded);
        return common ? `${common} m` : '';
      }
      return '';
    })();

    const canAutoReplace = (current: string, legacyOptions: string[]) =>
      !current || legacyOptions.includes(current.trim());

    const CEILING_TYPE_LEGACY = ['Concrete', 'Gypsum', 'Open Ceiling', 'Metal'];
    const WALL_TYPE_LEGACY = ['Concrete', 'Drywall', 'Glass', 'Wood'];
    const CEILING_HEIGHT_LEGACY = ['Low (<3m)', 'Medium (3–5m)', 'High (>5m)'];

    setPhysicalConstraints((prev) => {
      const next = { ...prev };
      if (ceilingTypeFromSurvey && canAutoReplace(prev.ceilingType, CEILING_TYPE_LEGACY)) next.ceilingType = ceilingTypeFromSurvey;
      if (wallTypeFromSurvey && canAutoReplace(prev.wallType, WALL_TYPE_LEGACY)) next.wallType = wallTypeFromSurvey;
      if (ceilingHeightFromSurvey && canAutoReplace(prev.ceilingHeight, CEILING_HEIGHT_LEGACY)) next.ceilingHeight = ceilingHeightFromSurvey;
      return next;
    });
  }, [showSiteConstraintsModal, type, cctvData, faData, fpData, acData, baData, otherData]);

  const uploadEstimationToApi = async (est: EstimationDetail) => {
    if (!baseUrl) return;
  
    // FIX 1: Force HTTPS to prevent the Dev Tunnel 308 redirect loop
    const secureBaseUrl = baseUrl.replace(/^http:\/\//i, 'https://');
    
    // FIX 2: Ensure your endpoint exactly matches the backend (watch out for trailing slashes!)
    const url = `${secureBaseUrl}/service/estimation/upload/estimationFile`;
  
    const projectForExport: Project = canViewSensitiveClientInfo
      ? project
      : {
          ...project,
          clientContact: 'REDACTED',
          clientEmail: 'REDACTED',
        };

    const roleScopedEstimation: EstimationDetail = canViewCosting
      ? est
      : {
          ...est,
          additionalFees: [],
          consumablesList: (est.consumablesList || []).map((entry) => ({ ...entry, unitPrice: undefined })),
        };

    const blob = await createEstimationDocx(
      projectForExport,
      type,
      {
        days: roleScopedEstimation.days,
        techs: roleScopedEstimation.techs,
        manpowerBreakdown: roleScopedEstimation.manpowerBreakdown,
        consumablesList: roleScopedEstimation.consumablesList,
        additionalFees: roleScopedEstimation.additionalFees
      },
      { cctvData, faData, fpData, acData, baData, otherData }
    );
  
    const fileName = `estimation_${project.id}_${String(type).replace(/\s+/g, '_')}.docx`;
    const file = new File([blob], fileName, { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    
    const formData = new FormData();
    formData.append('estimationDoc', file);
    formData.append('viewerRole', isTechnicianRestrictedView ? 'TECHNICIAN' : 'ADMIN');
    
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-Viewer-Role'] = isTechnicianRestrictedView ? 'TECHNICIAN' : 'ADMIN';
  
    // Optional: If Dev Tunnels still intercepts the request to show a "Warning" HTML page, 
    // you may need to uncomment this bypass header:
    // headers['X-Forwarded-Proto'] = 'https';
  
    await axios.post(url, formData, { headers, timeout: 30000 });
  };


  
  useEffect(() => {
    const sum = additionalFees.reduce((s, f) => s + f.amount, 0);
    setCosts(prev => ({ ...prev, additional: sum }));
  }, [additionalFees]);

  const consumablesTotal = consumablesList.reduce((s, e) => s + e.qty * (e.unitPrice ?? CONSUMABLE_DEFAULT_PRICES[e.name] ?? 0), 0);
  useEffect(() => {
    setCosts(prev => ({ ...prev, materials: consumablesTotal }));
  }, [consumablesTotal]);

  const PRICE_RANGES = {
    CCTV: {
      DOME_BULLET: { low: CCTV_MEAN.DOME_BULLET, high: CCTV_MEAN.DOME_BULLET },
      CAMERA_8MP: { low: CCTV_MEAN.CAMERA_8MP, high: CCTV_MEAN.CAMERA_8MP },
      AI_FACE_REC: { low: CCTV_MEAN.AI_FACE_REC, high: CCTV_MEAN.AI_FACE_REC },
      NVR_BASE: { low: CCTV_MEAN.NVR_BASE, high: CCTV_MEAN.NVR_BASE },
      CAT6_PER_METER: { low: CCTV_MEAN.CAT6_PER_METER, high: CCTV_MEAN.CAT6_PER_METER }
    },
    FIRE_PROTECTION: {
      EXTINGUISHER_ABC: { low: FIRE_PROTECTION_MEAN.EXTINGUISHER_ABC, high: FIRE_PROTECTION_MEAN.EXTINGUISHER_ABC },
      EXTINGUISHER_CO2: { low: FIRE_PROTECTION_MEAN.EXTINGUISHER_CO2, high: FIRE_PROTECTION_MEAN.EXTINGUISHER_CO2 },
      EXTINGUISHER_WATER: { low: FIRE_PROTECTION_MEAN.EXTINGUISHER_WATER, high: FIRE_PROTECTION_MEAN.EXTINGUISHER_WATER },
      EXTINGUISHER_FOAM: { low: FIRE_PROTECTION_MEAN.EXTINGUISHER_FOAM, high: FIRE_PROTECTION_MEAN.EXTINGUISHER_FOAM },
      EXTINGUISHER_K_CLASS: { low: FIRE_PROTECTION_MEAN.EXTINGUISHER_K_CLASS, high: FIRE_PROTECTION_MEAN.EXTINGUISHER_K_CLASS },
      HOSE_REEL_SET_30M: { low: FIRE_PROTECTION_MEAN.HOSE_REEL_SET_30M, high: FIRE_PROTECTION_MEAN.HOSE_REEL_SET_30M },
      FIRE_BLANKET: { low: FIRE_PROTECTION_MEAN.FIRE_BLANKET, high: FIRE_PROTECTION_MEAN.FIRE_BLANKET },
      EMERGENCY_LIGHT: { low: FIRE_PROTECTION_MEAN.EMERGENCY_LIGHT, high: FIRE_PROTECTION_MEAN.EMERGENCY_LIGHT },
      EXIT_SIGN: { low: FIRE_PROTECTION_MEAN.EXIT_SIGN, high: FIRE_PROTECTION_MEAN.EXIT_SIGN },
      SPRINKLER_HEAD: { low: FIRE_PROTECTION_MEAN.SPRINKLER_HEAD, high: FIRE_PROTECTION_MEAN.SPRINKLER_HEAD },
      PIPE_GI_PER_M: { low: FIRE_PROTECTION_MEAN.PIPE_GI_PER_M, high: FIRE_PROTECTION_MEAN.PIPE_GI_PER_M },
      PIPE_BLACK_STEEL_PER_M: { low: FIRE_PROTECTION_MEAN.PIPE_BLACK_STEEL_PER_M, high: FIRE_PROTECTION_MEAN.PIPE_BLACK_STEEL_PER_M },
      PIPE_CPVC_PER_M: { low: FIRE_PROTECTION_MEAN.PIPE_CPVC_PER_M, high: FIRE_PROTECTION_MEAN.PIPE_CPVC_PER_M },
      PIPE_OTHER_PER_M: { low: FIRE_PROTECTION_MEAN.PIPE_OTHER_PER_M, high: FIRE_PROTECTION_MEAN.PIPE_OTHER_PER_M },
      SUPPRESSION_BASE_TOTAL_FLOODING: { low: FIRE_PROTECTION_MEAN.SUPPRESSION_BASE_TOTAL_FLOODING, high: FIRE_PROTECTION_MEAN.SUPPRESSION_BASE_TOTAL_FLOODING },
      SUPPRESSION_BASE_LOCAL_APPLICATION: { low: FIRE_PROTECTION_MEAN.SUPPRESSION_BASE_LOCAL_APPLICATION, high: FIRE_PROTECTION_MEAN.SUPPRESSION_BASE_LOCAL_APPLICATION },
      SUPPRESSION_PER_NOZZLE: { low: FIRE_PROTECTION_MEAN.SUPPRESSION_PER_NOZZLE, high: FIRE_PROTECTION_MEAN.SUPPRESSION_PER_NOZZLE },
      FIRE_CABLE_METER: { low: FIRE_PROTECTION_MEAN.FIRE_CABLE_METER, high: FIRE_PROTECTION_MEAN.FIRE_CABLE_METER }
    },
    FIRE_ALARM: {
      SMOKE_CONVENTIONAL: { low: FIRE_ALARM_MEAN.SMOKE_CONVENTIONAL, high: FIRE_ALARM_MEAN.SMOKE_CONVENTIONAL },
      SMOKE_ADDRESSABLE: { low: FIRE_ALARM_MEAN.SMOKE_ADDRESSABLE, high: FIRE_ALARM_MEAN.SMOKE_ADDRESSABLE },
      HEAT_CONVENTIONAL: { low: FIRE_ALARM_MEAN.HEAT_CONVENTIONAL, high: FIRE_ALARM_MEAN.HEAT_CONVENTIONAL },
      HEAT_ADDRESSABLE: { low: FIRE_ALARM_MEAN.HEAT_ADDRESSABLE, high: FIRE_ALARM_MEAN.HEAT_ADDRESSABLE },
      MULTI_SENSOR: { low: FIRE_ALARM_MEAN.MULTI_SENSOR, high: FIRE_ALARM_MEAN.MULTI_SENSOR },
      FLAME: { low: FIRE_ALARM_MEAN.FLAME, high: FIRE_ALARM_MEAN.FLAME },
      GAS: { low: FIRE_ALARM_MEAN.GAS, high: FIRE_ALARM_MEAN.GAS },
      DETECTOR_OTHER: { low: FIRE_ALARM_MEAN.DETECTOR_OTHER, high: FIRE_ALARM_MEAN.DETECTOR_OTHER },
      FACP_CONVENTIONAL: { low: FIRE_ALARM_MEAN.FACP_CONVENTIONAL, high: FIRE_ALARM_MEAN.FACP_CONVENTIONAL },
      FACP_ADDRESSABLE: { low: FIRE_ALARM_MEAN.FACP_ADDRESSABLE, high: FIRE_ALARM_MEAN.FACP_ADDRESSABLE },
      FACP_WIRELESS: { low: FIRE_ALARM_MEAN.FACP_WIRELESS, high: FIRE_ALARM_MEAN.FACP_WIRELESS },
      BELL: { low: FIRE_ALARM_MEAN.BELL, high: FIRE_ALARM_MEAN.BELL },
      HORN: { low: FIRE_ALARM_MEAN.HORN, high: FIRE_ALARM_MEAN.HORN },
      STROBE: { low: FIRE_ALARM_MEAN.STROBE, high: FIRE_ALARM_MEAN.STROBE },
      HORN_STROBE: { low: FIRE_ALARM_MEAN.HORN_STROBE, high: FIRE_ALARM_MEAN.HORN_STROBE },
      MCP: { low: FIRE_ALARM_MEAN.MCP, high: FIRE_ALARM_MEAN.MCP },
      NOTIFICATION_AVG: { low: FIRE_ALARM_MEAN.NOTIFICATION_AVG, high: FIRE_ALARM_MEAN.NOTIFICATION_AVG },
      BATTERY_7AH: { low: FIRE_ALARM_MEAN.BATTERY_7AH, high: FIRE_ALARM_MEAN.BATTERY_7AH },
      FIRE_CABLE_METER: { low: FIRE_ALARM_MEAN.FIRE_CABLE_METER, high: FIRE_ALARM_MEAN.FIRE_CABLE_METER },
      JUNCTION_BOX: { low: 35, high: 50 },
      DETECTOR: { low: FIRE_ALARM_MEAN.DETECTOR, high: FIRE_ALARM_MEAN.DETECTOR },
      FACP_BASE: { low: FIRE_ALARM_MEAN.FACP_BASE, high: FIRE_ALARM_MEAN.FACP_BASE }
    },
    LABOR: {
      TECH_RATE_DAY: { low: 1200, high: 2500 }
    },
    VAT_RATE: 0.12
  };

  /**
   * CALCULATED AGGREGATE MAN-DAYS
   * Logic: Sum of (Manpower Count * (Assigned Hours / 8)) for all entries.
   * This represents the total billable units of labor for the project phase.
   */
  const totalManDays = manpowerBreakdown.reduce((acc, curr) => acc + (curr.count * (curr.hours / 8)), 0);

  useEffect(() => {
    // Update labor details for display/summary based on breakdown
    // Site Days displayed to user is the maximum duration assigned to any single role (parallelism)
    // Manpower is the total unique people assigned
    const maxDurationDays = manpowerBreakdown.reduce((acc, curr) => Math.max(acc, curr.hours / 8), 0);
    const totalTechs = manpowerBreakdown.reduce((acc, curr) => acc + curr.count, 0);
    
    setLaborDetails({ days: maxDurationDays, techs: totalTechs });
  }, [manpowerBreakdown]);

  useEffect(() => {
    let equipSum = 0;
    let cableTotal = 0;
    let cableRate: number = PRICE_RANGES.CCTV.CAT6_PER_METER.low;

    if (type === SurveyType.CCTV && cctvData) {
      const computed = computeCctvMeanCosts(cctvData);
      equipSum = computed.equipment;
      cableTotal = computed.cableMeters;
      cableRate = CCTV_MEAN.CAT6_PER_METER;
    } 
    else if (type === SurveyType.FIRE_ALARM && faData) {
      const computed = computeFireAlarmMeanCosts(faData);
      equipSum = computed.equipment;
      cableTotal = computed.cableMeters;
      cableRate = FIRE_ALARM_MEAN.FIRE_CABLE_METER;
    } 
    else if (type === SurveyType.ACCESS_CONTROL && acData) {
      // Mean-average pricing for Access Control hardware components.
      const computed = computeAccessControlMeanCosts(acData);
      equipSum = computed.equipment;
      cableTotal = computed.cableMeters;
      cableRate = ACCESS_CONTROL_MEAN.CABLING_PER_METER;
    }
    else if (type === SurveyType.FIRE_PROTECTION && fpData) {
      const computed = computeFireProtectionMeanCosts(fpData);
      equipSum = computed.equipment;
      cableTotal = computed.cableMeters;
      cableRate = FIRE_PROTECTION_MEAN.FIRE_CABLE_METER;
    }
    else if (type === SurveyType.BURGLAR_ALARM && baData) {
      const computed = computeBurglarAlarmMeanCosts(baData);
      equipSum = computed.equipment;
      cableTotal = computed.cableMeters;
      cableRate = BURGLAR_ALARM_MEAN.CABLE_PER_METER;
    }
    else if (type === SurveyType.OTHER && otherData) {
      equipSum = otherData.estimatedCost || 0;
      cableTotal = otherData.cablesCost || 0;
      cableRate = 1;
    }

    // Labor: sum per role of (count × hours × ₱/hour) using role-based rates
    const laborTotal = manpowerBreakdown.reduce((sum, entry) => {
      const rate = LABOR_RATE_PER_HOUR[entry.role] ?? 120;
      return sum + entry.count * entry.hours * rate;
    }, 0);

    setCosts(prev => ({
      ...prev,
      equipment: equipSum,
      cables: cableTotal * cableRate,
      labor: laborTotal
    }));
  }, [type, cctvData, faData, fpData, acData, baData, otherData, manpowerBreakdown]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      minimumFractionDigits: 2 
    }).format(val);
  };

  const availableSurveys = Object.values(SurveyType).filter(s => {
    if (s === SurveyType.CCTV) return !cctvData;
    if (s === SurveyType.FIRE_ALARM) return !faData;
    if (s === SurveyType.FIRE_PROTECTION) return !fpData;
    if (s === SurveyType.ACCESS_CONTROL) return !acData;
    if (s === SurveyType.BURGLAR_ALARM) return !baData;
    if (s === SurveyType.OTHER) return !otherData;
    return false;
  });

  const handleOpenEdit = (entry: ManpowerEntry) => {
    setEditingEntry(entry);
    setInputHours(entry.hours.toString());
    setInputCount(entry.count.toString());
    setShowEffortModal(true);
  };

  const handleOpenAdd = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setEditingEntry({
      id: newId,
      role: ROLES[0],
      count: 1,
      hours: 8
    });
    setInputHours('8');
    setInputCount('1');
    setShowEffortModal(true);
  };

  const handleDeleteEntry = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setManpowerBreakdown(prev => prev.filter(item => item.id !== id));
  };

  const consumableQtyKey = (category: string, item: string) => `${category}|${item}`;
  const getConsumableQty = (category: string, item: string) => {
    const raw = consumableQuantities[consumableQtyKey(category, item)];
    const n = parseInt(raw || '1', 10);
    return isNaN(n) || n < 1 ? 1 : n;
  };
  const setConsumableQty = (category: string, item: string, value: string) => {
    setConsumableQuantities(prev => ({ ...prev, [consumableQtyKey(category, item)]: value }));
  };
  const saveEditedConsumable = () => {
    if (editingConsumableId == null) return;
    const qty = Math.max(1, parseInt(editingConsumableQty, 10) || 1);
    setConsumablesList(prev => prev.map(c => c.id === editingConsumableId ? { ...c, qty } : c));
    setEditingConsumableId(null);
    setEditingConsumableQty('');
  };

  const addConsumableToList = (category: string, name: string) => {
    const qty = getConsumableQty(category, name);
    setConsumablesList(prev => {
      const existing = prev.find(c => c.name === name);
      if (existing) {
        const totalQty = prev
          .filter(c => c.name === name)
          .reduce((sum, c) => sum + c.qty, 0) + qty;
        const rest = prev.filter(c => c.name !== name);
        return [...rest, { ...existing, qty: totalQty }];
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name,
        category,
        qty,
        unitPrice: CONSUMABLE_DEFAULT_PRICES[name] ?? 0
      }];
    });
    setConsumableQty(category, name, '1');
  };

  const handleSaveEffortEntry = () => {
    if (!editingEntry) return;

    const finalHours = parseInt(inputHours) || 0;
    const finalCount = parseInt(inputCount) || 1;

    const updated = {
      ...editingEntry,
      hours: finalHours,
      count: finalCount
    };

    setManpowerBreakdown(prev => {
      const idx = prev.findIndex(item => item.id === updated.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      // Adding new: merge with existing entry that has same role and hours
      const sameRoleHours = prev.filter(item => item.role === updated.role && item.hours === updated.hours);
      if (sameRoleHours.length > 0) {
        const totalCount = sameRoleHours.reduce((sum, item) => sum + item.count, 0) + updated.count;
        const merged = { ...sameRoleHours[0], count: totalCount };
        const rest = prev.filter(item => !(item.role === updated.role && item.hours === updated.hours));
        return [...rest, merged];
      }
      return [...prev, updated];
    });
    setShowEffortModal(false);
    setEditingEntry(null);
  };

  const subtotal = costs.equipment + costs.cables + costs.labor + costs.additional + costs.materials;
  const tax = subtotal * PRICE_RANGES.VAT_RATE;
  const total = subtotal + tax;

  return (
    <div className="h-full bg-white flex flex-col p-6 animate-fade-in text-slate-900 overflow-hidden relative">
      <header className="shrink-0 mb-4">
        <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Estimation: {type}</h2>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* CONSUMABLES + PHASE EFFORT SECTION - MATCHES MANPOWER BORDER STYLE */}
        <div className="border-2 border-slate-200 rounded-[1.5rem] overflow-hidden bg-white shadow-sm">
          <div className="p-6 space-y-4">
            <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-widest ml-2 opacity-50">Consumables</h3>
            {consumablesList.length > 0 && (
              <div className="space-y-3">
                {consumablesList.map((entry) => {
                  const isEditing = editingConsumableId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        if (!isEditing) {
                          setEditingConsumableId(entry.id);
                          setEditingConsumableQty(entry.qty.toString());
                        }
                      }}
                      className={`flex items-center justify-between py-1 px-3 bg-slate-50 border-2 rounded-[1.5rem] cursor-pointer transition-colors ${isEditing ? 'border-blue-900 ring-2 ring-blue-900/20' : 'border-slate-200'}`}
                    >
                      <span className="font-normal text-xs uppercase tracking-tight text-slate-700">{entry.name}</span>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              min={1}
                              className="w-24 min-w-[5rem] py-1.5 px-2 border-2 border-blue-900 rounded-lg text-center text-xs font-normal text-slate-700 outline-none"
                              value={editingConsumableQty}
                              onChange={(e) => setEditingConsumableQty(e.target.value.replace(/\D/g, '') || '1')}
                              onBlur={saveEditedConsumable}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditedConsumable(); }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveEditedConsumable}
                              className="w-8 h-8 flex items-center justify-center text-blue-900 rounded-lg hover:bg-blue-50 transition"
                              aria-label="Save"
                            >
                              <i className="fas fa-check text-sm"></i>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-normal text-blue-900 uppercase">×{entry.qty}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) { setEditingConsumableId(null); setEditingConsumableQty(''); }
                            setConsumablesList(prev => prev.filter(c => c.id !== entry.id));
                          }}
                          className="w-8 h-8 flex items-center justify-center text-blue-900/30 hover:text-red-600 transition-colors"
                          aria-label="Remove"
                        >
                          <i className="fas fa-trash-can text-base"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {consumablesList.length === 0 && (
              <div className="py-3 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                NO CONSUMABLE ASSIGNED
              </div>
            )}
            <button
              type="button"
              onClick={() => { setShowConsumableModal(true); setExpandedConsumableCategory(null); setConsumableQuantities({}); }}
              className="w-full py-4 bg-white border-[3px] border-blue-900 rounded-[1rem] font-black text-sm uppercase tracking-widest text-blue-900 transition hover:bg-blue-50 active:scale-[0.98]"
            >
              Add Consumables
            </button>
            <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-widest ml-2 opacity-50">Phase Effort Details</h3>
            
            <div className="space-y-3">
              {manpowerBreakdown.map((entry) => (
                <div 
                  key={entry.id}
                  onClick={() => handleOpenEdit(entry)}
                  className="flex items-center justify-between py-1 px-3 bg-slate-50 border-2 border-slate-200 rounded-[1.5rem] active:scale-[0.98] transition-transform cursor-pointer group"
                >
                  <span className="font-normal text-xs uppercase tracking-tight text-slate-700">
                    {entry.role.toUpperCase()} – {entry.hours} HRS
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-blue-900 uppercase">×{entry.count}</span>
                    <button 
                      onClick={(e) => handleDeleteEntry(e, entry.id)}
                      className="w-8 h-8 flex items-center justify-center text-blue-900/30 hover:text-red-600 transition-colors"
                    >
                      <i className="fas fa-trash-can text-base"></i>
                    </button>
                  </div>
                </div>
              ))}

              {manpowerBreakdown.length === 0 && (
                <div className="py-3 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                  No manpower assigned
                </div>
              )}
            </div>

            <button 
              onClick={handleOpenAdd}
              className="w-full py-4 bg-white border-[3px] border-blue-900 rounded-[1rem] font-black text-sm uppercase tracking-widest text-blue-900 active:scale-[0.97] transition-all"
            >
              ADD MANPOWER
            </button>

            <div className="px-1 -mt-1 grid gap-3 grid-cols-3">
              <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Physical Constraints</p>
                  <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPhysicalImpact().badgeClass}`}>
                    {getPhysicalImpact().label}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] font-bold text-slate-700">
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Structure / Environment</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStructureImpact().badgeClass}`}>
                      {getStructureImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Space Condition</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getSpaceImpact().badgeClass}`}>
                      {getSpaceImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Routing Difficulty</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getRoutingImpact().badgeClass}`}>
                      {getRoutingImpact().label}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Electrical Constraints</p>
                  <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getElectricalImpact().badgeClass}`}>
                    {getElectricalImpact().label}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] font-bold text-slate-700">
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Power Availability</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPowerAvailabilityImpact().badgeClass}`}>
                      {getPowerAvailabilityImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Power Quality</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPowerQualityImpact().badgeClass}`}>
                      {getPowerQualityImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Backup &amp; Protection</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getBackupImpact().badgeClass}`}>
                      {getBackupImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Electrical Capacity</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getCapacityImpact().badgeClass}`}>
                      {getCapacityImpact().label}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Installation Constraints</p>
                  <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getInstallationImpact().badgeClass}`}>
                    {getInstallationImpact().label}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] font-bold text-slate-700">
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Work Restrictions</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getWorkRestrictionsImpact().badgeClass}`}>
                      {getWorkRestrictionsImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Permits &amp; Compliance</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPermitsImpact().badgeClass}`}>
                      {getPermitsImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Accessibility</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getAccessibilityImpact().badgeClass}`}>
                      {getAccessibilityImpact().label}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">- Installation Complexity</span>
                    <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getInstallationComplexityImpact().badgeClass}`}>
                      {getInstallationComplexityImpact().label}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSiteConstraintsModal(true)}
              className="w-full py-4 bg-white border-[3px] border-blue-900 rounded-[1rem] font-black text-sm uppercase tracking-widest text-blue-900 active:scale-[0.97] transition-all"
            >
              SITE CONSTRAINTS
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <button
            type="button"
            onClick={() => setShowInventoryRecountModal(true)}
            className="w-full py-3 border-2 border-blue-600 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 hover:border-blue-900 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition-colors"
          >
            Inventory Recount
          </button>
        </div>

        <div className="px-2 pt-2 space-y-1">
          <p className="text-sm font-black text-blue-900 uppercase flex justify-between items-center">
            <span>Billable Labor:</span> 
            <span className="bg-blue-100 px-2 py-0.5 rounded ml-1">{totalManDays.toFixed(2)} Man-Days</span>
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase italic">
            * Duration: {laborDetails.days.toFixed(1)} Days | Techs: {laborDetails.techs}
          </p>
        </div>

        {canViewCosting ? (
          <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
            {[
              { label: 'Calculated Hardware Sum', val: costs.equipment },
              { label: 'Cabling Infrastructure', val: costs.cables },
              { label: 'Consumables Total', val: consumablesTotal }
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-sm font-bold shrink-0">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-mono text-slate-900 text-right w-32 shrink-0">{formatCurrency(item.val)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm font-bold shrink-0">
              <span className="text-slate-500">Total Professional Labor</span>
              <span className="font-mono text-slate-900 text-right w-32 shrink-0">{formatCurrency(costs.labor)}</span>
            </div>
            {additionalFees.map((f) => (
              <div key={f.id} className="flex justify-between items-center text-sm font-bold shrink-0">
                <span className="text-slate-500">{f.type}</span>
                <span className="font-mono text-slate-900 text-right w-32 shrink-0">{formatCurrency(f.amount)}</span>
              </div>
            ))}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => { setShowAdditionalFeeModal(true); setAdditionalFeeAmountInput(''); }}
                className="w-full py-3 border-2 border-blue-900 rounded-xl text-[10px] font-black text-blue-900 uppercase tracking-widest hover:bg-blue-50 transition active:scale-[0.98]"
              >
                Additional Fee
              </button>
            </div>
            
            <div className="pt-4 space-y-2 border-t border-slate-100 pb-4">
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight text-slate-400">
                <span>Subtotal ({type})</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight text-slate-400">
                <span>VAT (12%)</span><span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-blue-900">
                <span className="text-lg font-black text-blue-900 uppercase">ESTIMATED ({type})</span>
                <span className="text-xl font-black font-mono text-blue-900">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-100 pb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Costing and billing details are hidden for technician view.
            </p>
          </div>
        )}

        {/* Action buttons – scroll with content below Estimated section */}
        <div className="pt-6 space-y-3 pb-6">
          <button
            disabled={isUploading}
            onClick={async () => {
              const est: EstimationDetail = {
                days: laborDetails.days,
                techs: laborDetails.techs,
                manpowerBreakdown,
                consumablesList,
                additionalFees: canViewCosting ? additionalFees : [],
                siteConstraintPhysical: siteConstraintPhysical || undefined,
                siteConstraintElectrical: siteConstraintElectrical || undefined,
                siteConstraintInstallation: siteConstraintInstallation || undefined,
              };
              setUploadError(null);
              if (baseUrl) {
                setIsUploading(true);
                try {
                  await uploadEstimationToApi(est);
                } catch (err: unknown) {
                  const msg = axios.isAxiosError(err) ? (err.response?.data?.message || err.message) : (err instanceof Error ? err.message : 'Upload failed');
                  setUploadError(msg);
                  setIsUploading(false);
                  return;
                }
                setIsUploading(false);
              }
              onComplete(est);
            }}
            className="w-full py-4 bg-blue-900 text-white font-black rounded-xl shadow-xl active:scale-95 transition tracking-widest uppercase disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploading ? 'UPLOADING…' : (canViewCosting ? 'FINALIZE FULL REPORT' : 'SAVE TECHNICAL BREAKDOWN')}
          </button>
          {uploadError && (
            <p className="text-red-600 text-sm font-medium text-center mt-1" role="alert">{uploadError}</p>
          )}
          {availableSurveys.length > 0 && (
            <button onClick={() => setShowAddModal(true)} className="w-full py-4 border-2 border-blue-900 bg-white text-blue-900 font-black rounded-xl active:scale-95 transition tracking-widest uppercase text-[11px]">ADD ANOTHER SYSTEM</button>
          )}
          <div>
            <button onClick={onBack} className="w-full text-blue-600 font-black uppercase text-xs tracking-[0.3em] py-4 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition active:scale-95">BACK TO AUDIT</button>
          </div>
        </div>
      </div>

      {/* EFFORT CONFIGURATION MODAL - SAME SIZE AS CONSUMABLES MODAL */}
      {showEffortModal && editingEntry && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-3 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">MANPOWER ASSIGNMENT</h3>
              <button 
                onClick={() => { setShowEffortModal(false); setEditingEntry(null); }} 
                className="text-slate-400 hover:text-blue-900 transition touch-target"
                aria-label="Close"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* ROLE SELECTION */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SELECT ROLE</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 py-3 px-4 pr-10 rounded-xl text-sm font-black text-blue-900 outline-none focus:border-blue-900 transition appearance-none"
                    value={editingEntry.role}
                    onChange={(e) => setEditingEntry({...editingEntry, role: e.target.value})}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-900">
                    <i className="fas fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              {/* HOURS INPUT: FULLY EDITABLE */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TOTAL DURATION FOR THIS ROLE (HOURS)</label>
                <div className="relative flex items-center bg-white border-2 border-blue-900 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-900/20">
                  <input 
                    type="number"
                    className="w-full bg-transparent py-3 px-4 pr-12 text-lg font-black text-blue-900 outline-none"
                    value={inputHours}
                    onChange={(e) => setInputHours(e.target.value)}
                  />
                  <div className="absolute right-3 flex items-center shrink-0 pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 uppercase">HRS</span>
                  </div>
                </div>
              </div>

              {/* MANPOWER COUNT: FULLY EDITABLE */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">MANPOWER COUNT</label>
                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => {
                      const cur = parseInt(inputCount) || 0;
                      setInputCount(Math.max(1, cur - 1).toString());
                    }}
                    className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 active:scale-90 transition shadow-sm"
                   >
                     <i className="fas fa-minus text-base"></i>
                   </button>
                   
                   <div className="flex-1 text-center">
                     <input 
                      type="number"
                      className="w-full bg-transparent text-center font-black text-2xl text-blue-900 outline-none"
                      value={inputCount}
                      onChange={(e) => setInputCount(e.target.value)}
                     />
                   </div>

                   <button 
                    onClick={() => {
                      const cur = parseInt(inputCount) || 0;
                      setInputCount((cur + 1).toString());
                    }}
                    className="w-11 h-11 rounded-xl bg-blue-900 flex items-center justify-center text-white active:scale-90 transition shadow-lg"
                   >
                     <i className="fas fa-plus text-base"></i>
                   </button>
                </div>
                {inputHours && inputCount && (
                  <p className="text-[8px] text-slate-400 font-bold uppercase text-center mt-1.5 opacity-60">
                    * TOTAL EFFORT FOR THIS GROUP: {( (parseFloat(inputHours)||0) * (parseFloat(inputCount)||1) / 8 ).toFixed(2)} MAN-DAYS
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
               <button 
                onClick={() => { setShowEffortModal(false); setEditingEntry(null); }}
                className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-400 font-black rounded-xl text-[11px] uppercase tracking-widest active:scale-95 transition shadow-sm"
               >
                 CANCEL
               </button>
               <button 
                onClick={handleSaveEffortEntry}
                className="flex-1 py-3 bg-white border-2 border-blue-900 text-blue-900 font-black rounded-xl text-[11px] uppercase tracking-widest shadow-sm active:scale-95 transition hover:bg-blue-50"
               >
                 {manpowerBreakdown.some(item => item.id === editingEntry.id) ? 'SAVE CHANGES' : 'ADD TO EFFORT'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* APPEND MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">Append Audit Component</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-blue-900 transition">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {availableSurveys.map(s => (
                <button 
                  key={s}
                  onClick={() => {
        const est: EstimationDetail = { days: laborDetails.days, techs: laborDetails.techs, manpowerBreakdown, consumablesList, additionalFees };
                    if (s === SurveyType.CCTV) onContinueCCTV(est);
                    else if (s === SurveyType.FIRE_ALARM) onContinueFA(est);
                    else if (s === SurveyType.FIRE_PROTECTION) onContinueFP(est);
                    else if (s === SurveyType.ACCESS_CONTROL) onContinueAC(est);
                    else if (s === SurveyType.BURGLAR_ALARM) onContinueBA(est);
                    else onContinueOther(est);
                    setShowAddModal(false);
                  }}
                  className="w-full p-4 rounded-xl border-2 border-blue-900/10 hover:border-blue-900 hover:bg-blue-50 text-blue-900 font-black text-sm uppercase transition-all shadow-sm bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
               <button onClick={() => setShowAddModal(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-900 transition">Cancel Append</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CONSUMABLE MODAL */}
      {showConsumableModal && (
        <div className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowConsumableModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">Add Consumable</h3>
              <button onClick={() => setShowConsumableModal(false)} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto min-h-0">
              {CONSUMABLE_CATEGORIES.map((cat) => (
                <div key={cat.key} className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedConsumableCategory(prev => prev === cat.key ? null : cat.key)}
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span>{cat.label}</span>
                    <i className={`fas fa-chevron-down transition-transform ${expandedConsumableCategory === cat.key ? 'rotate-180' : ''}`}></i>
                  </button>
                  {expandedConsumableCategory === cat.key && (
                    <div className="border-t border-slate-100 p-3 space-y-2 max-h-[50vh] overflow-y-auto">
                      {cat.items.map((item) => (
                        <div key={item} className="flex items-center gap-2 flex-wrap">
                          <span className="flex-1 min-w-[140px] text-[11px] font-bold text-slate-700">{item}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              className="w-16 h-9 px-2 border-2 border-slate-200 rounded-lg text-center text-xs font-black text-blue-900 outline-none focus:border-blue-900"
                              value={consumableQuantities[consumableQtyKey(cat.key, item)] ?? '1'}
                              onChange={(e) => setConsumableQty(cat.key, item, e.target.value.replace(/\D/g, ''))}
                            />
                            <button
                              type="button"
                              onClick={() => addConsumableToList(cat.key, item)}
                              className="h-9 px-3 bg-blue-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowConsumableModal(false)} className="w-full py-3 bg-white border-2 border-blue-900 text-blue-900 font-black rounded-xl text-[11px] uppercase tracking-widest active:scale-[0.98] transition hover:bg-blue-50">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL FEE MODAL */}
      {showAdditionalFeeModal && (
        <div className="fixed inset-0 z-[107] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in overflow-y-auto" onClick={() => setShowAdditionalFeeModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">Additional Fee</h3>
              <button onClick={() => setShowAdditionalFeeModal(false)} className="text-slate-400 hover:text-blue-900 transition" aria-label="Close">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Type of Additional Fee</label>
                  <select
                    value={additionalFeeType}
                    onChange={(e) => setAdditionalFeeType(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 bg-white focus:border-blue-900 outline-none"
                  >
                    {ADDITIONAL_FEE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cost Amount</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-right text-sm font-mono text-slate-900 focus:border-blue-900 outline-none"
                    value={additionalFeeAmountInput}
                    onChange={(e) => setAdditionalFeeAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const amount = parseFloat(additionalFeeAmountInput.replace(/,/g, '')) || 0;
                  if (amount <= 0) return;
                  setAdditionalFees(prev => [...prev, { id: Math.random().toString(36).slice(2), type: additionalFeeType, amount }]);
                  setAdditionalFeeAmountInput('');
                }}
                className="w-full py-3 bg-white border-2 border-blue-900 text-blue-900 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-blue-50 transition active:scale-[0.98]"
              >
                Add Fee
              </button>
              {additionalFees.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Added fees</p>
                  {additionalFees.map((f) => (
                    <div key={f.id} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl">
                      <span className="text-sm font-bold text-slate-700">{f.type}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{formatCurrency(f.amount)}</span>
                        <button
                          type="button"
                          onClick={() => setAdditionalFees(prev => prev.filter(x => x.id !== f.id))}
                          className="text-red-500 hover:text-red-700 p-1"
                          aria-label="Remove"
                        >
                          <i className="fas fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowAdditionalFeeModal(false)}
                className="w-full py-3 bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-300 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SITE CONSTRAINTS MODAL */}
      {showSiteConstraintsModal && (
        <div
          className="fixed inset-0 z-[108] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={() => setShowSiteConstraintsModal(false)}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fade-in my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs pl-1">Site Constraints</h3>
              <button
                onClick={() => setShowSiteConstraintsModal(false)}
                className="text-slate-400 hover:text-blue-900 transition pr-1"
                aria-label="Close"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-5 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-3">
                {/* Physical */}
                <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedSiteConstraintSection((prev) => (prev === 'physical' ? null : 'physical'))}
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span>Physical Constraints</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPhysicalImpact().badgeClass}`}
                      >
                        {getPhysicalImpact().label}
                      </span>
                      <i className={`fas fa-chevron-down transition-transform ${expandedSiteConstraintSection === 'physical' ? 'rotate-180' : ''}`}></i>
                    </div>
                  </button>
                  {expandedSiteConstraintSection === 'physical' && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="space-y-2">
                        {/* Structure / Environment */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedPhysicalConstraintCategory((prev) => (prev === 'structure' ? null : 'structure'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Structure / Environment</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedPhysicalConstraintCategory === 'structure' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedPhysicalConstraintCategory === 'structure' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Floor Levels</p>
                                <div className="relative">
                                  <input
                                    value={physicalConstraints.floorLevels}
                                    onChange={(e) => setPhysicalConstraints((prev) => ({ ...prev, floorLevels: e.target.value }))}
                                    placeholder="e.g., Single / Multi-floor / 3 floors"
                                    className="w-full bg-white border-2 border-slate-200 py-1.5 px-4 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs transition"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ceiling Type</p>
                                <div className="relative">
                                  <input
                                    value={physicalConstraints.ceilingType}
                                    onChange={(e) => setPhysicalConstraints((prev) => ({ ...prev, ceilingType: e.target.value }))}
                                    placeholder="e.g., Concrete / Gypsum"
                                    className="w-full bg-white border-2 border-slate-200 py-1.5 px-4 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs transition"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ceiling Height</p>
                                <div className="relative">
                                  <input
                                    value={physicalConstraints.ceilingHeight}
                                    onChange={(e) => setPhysicalConstraints((prev) => ({ ...prev, ceilingHeight: e.target.value }))}
                                    placeholder="e.g., 3.5 m / High"
                                    className="w-full bg-white border-2 border-slate-200 py-1.5 px-4 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs transition"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Wall Type</p>
                                <div className="relative">
                                  <input
                                    value={physicalConstraints.wallType}
                                    onChange={(e) => setPhysicalConstraints((prev) => ({ ...prev, wallType: e.target.value }))}
                                    placeholder="e.g., Concrete / Glass"
                                    className="w-full bg-white border-2 border-slate-200 py-1.5 px-4 rounded-xl text-slate-900 font-bold focus:border-blue-900 outline-none text-xs transition"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Space Condition */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedPhysicalConstraintCategory((prev) => (prev === 'space' ? null : 'space'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Space Condition</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedPhysicalConstraintCategory === 'space' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedPhysicalConstraintCategory === 'space' && (
                            <div className="border-t border-slate-100 p-4 space-y-4">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Space Accessibility</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Open', 'Tight', 'Congested'] as const).map((v) => {
                                    const selected = physicalConstraints.spaceAccessibility === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setPhysicalConstraints((prev) => ({ ...prev, spaceAccessibility: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Obstructions</p>
                                <div className="rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>No</span>
                                    <span className="text-blue-900">{Math.round(physicalConstraints.obstructionsPercent)}%</span>
                                    <span>Yes</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={physicalConstraints.obstructionsPercent}
                                    onChange={(e) =>
                                      setPhysicalConstraints((prev) => ({
                                        ...prev,
                                        obstructionsPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                      }))
                                    }
                                    className="mt-0.5 w-full accent-blue-900"
                                    aria-label="Obstructions percentage"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available Mounting Points</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Adequate', 'Limited', 'None'] as const).map((v) => {
                                    const selected = physicalConstraints.mountingPoints === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setPhysicalConstraints((prev) => ({ ...prev, mountingPoints: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Routing Difficulty */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedPhysicalConstraintCategory((prev) => (prev === 'routing' ? null : 'routing'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Routing Difficulty</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedPhysicalConstraintCategory === 'routing' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedPhysicalConstraintCategory === 'routing' && (
                            <div className="border-t border-slate-100 p-4 space-y-4">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cable Path Condition</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Straight', 'With bends', 'Complex'] as const).map((v) => {
                                    const selected = physicalConstraints.cablePathCondition === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setPhysicalConstraints((prev) => ({ ...prev, cablePathCondition: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Obstructions</p>
                                <div className="rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>No</span>
                                    <span className="text-blue-900">{Math.round(physicalConstraints.routingObstructionsPercent)}%</span>
                                    <span>Yes</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={physicalConstraints.routingObstructionsPercent}
                                    onChange={(e) =>
                                      setPhysicalConstraints((prev) => ({
                                        ...prev,
                                        routingObstructionsPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                      }))
                                    }
                                    className="mt-0.5 w-full accent-blue-900"
                                    aria-label="Routing obstructions percentage"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Distance Between Devices</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Short', 'Medium', 'Long'] as const).map((v) => {
                                    const selected = physicalConstraints.distanceBetweenDevices === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setPhysicalConstraints((prev) => ({ ...prev, distanceBetweenDevices: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Electrical */}
                <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedSiteConstraintSection((prev) => (prev === 'electrical' ? null : 'electrical'))}
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span>Electrical Constraints</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getElectricalImpact().badgeClass}`}>
                        {getElectricalImpact().label}
                      </span>
                      <i className={`fas fa-chevron-down transition-transform ${expandedSiteConstraintSection === 'electrical' ? 'rotate-180' : ''}`}></i>
                    </div>
                  </button>
                  {expandedSiteConstraintSection === 'electrical' && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="space-y-2">
                        {/* Power Availability */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedElectricalConstraintCategory((prev) => (prev === 'availability' ? null : 'availability'))
                            }
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Power Availability</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedElectricalConstraintCategory === 'availability' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedElectricalConstraintCategory === 'availability' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Power Source Nearby</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = electricalConstraints.powerSourceNearby === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setElectricalConstraints((prev) => ({ ...prev, powerSourceNearby: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Distance to Power Source</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Near', 'Moderate', 'Far'] as const).map((v) => {
                                    const selected = electricalConstraints.distanceToPowerSource === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setElectricalConstraints((prev) => ({ ...prev, distanceToPowerSource: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Power Quality */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedElectricalConstraintCategory((prev) => (prev === 'quality' ? null : 'quality'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Power Quality</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedElectricalConstraintCategory === 'quality' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedElectricalConstraintCategory === 'quality' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Voltage Type</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['220V', '110V', 'Mixed'] as const).map((v) => {
                                    const selected = electricalConstraints.voltageType === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setElectricalConstraints((prev) => ({ ...prev, voltageType: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Power Stability</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Stable', 'Unstable'] as const).map((v) => {
                                    const selected = electricalConstraints.powerStability === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setElectricalConstraints((prev) => ({ ...prev, powerStability: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Backup & Protection */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedElectricalConstraintCategory((prev) => (prev === 'backup' ? null : 'backup'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Backup &amp; Protection</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedElectricalConstraintCategory === 'backup' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedElectricalConstraintCategory === 'backup' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              {[
                                { key: 'upsAvailable', label: 'UPS Available' },
                                { key: 'generatorAvailable', label: 'Generator Available' },
                                { key: 'surgeProtectionNeeded', label: 'Surge Protection Needed' },
                              ].map(({ key, label }) => (
                                <div key={key} className="space-y-1.5">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {(['Yes', 'No'] as const).map((v) => {
                                      const selected = (electricalConstraints as any)[key] === v;
                                      return (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => setElectricalConstraints((prev) => ({ ...prev, [key]: v } as any))}
                                          className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                            selected
                                              ? 'bg-blue-900 border-blue-900 text-white'
                                              : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Electrical Capacity */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedElectricalConstraintCategory((prev) => (prev === 'capacity' ? null : 'capacity'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Electrical Capacity</span>
                            <i className={`fas fa-chevron-down transition-transform ${expandedElectricalConstraintCategory === 'capacity' ? 'rotate-180' : ''}`}></i>
                          </button>
                          {expandedElectricalConstraintCategory === 'capacity' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spare Circuit Available</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = electricalConstraints.spareCircuitAvailable === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setElectricalConstraints((prev) => ({ ...prev, spareCircuitAvailable: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Panel Accessibility</p>
                                <div className="rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>Easy</span>
                                    <span className="text-blue-900">{Math.round(electricalConstraints.panelAccessibilityPercent)}%</span>
                                    <span>Restricted</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={electricalConstraints.panelAccessibilityPercent}
                                    onChange={(e) =>
                                      setElectricalConstraints((prev) => ({
                                        ...prev,
                                        panelAccessibilityPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                      }))
                                    }
                                    className="mt-0.5 w-full accent-blue-900"
                                    aria-label="Panel accessibility percentage"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Installation */}
                <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedSiteConstraintSection((prev) => (prev === 'installation' ? null : 'installation'))}
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span>Installation Constraints</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getInstallationImpact().badgeClass}`}>
                        {getInstallationImpact().label}
                      </span>
                      <i className={`fas fa-chevron-down transition-transform ${expandedSiteConstraintSection === 'installation' ? 'rotate-180' : ''}`}></i>
                    </div>
                  </button>
                  {expandedSiteConstraintSection === 'installation' && (
                    <div className="border-t border-slate-100 p-4">
                      <div className="space-y-3">
                        {/* Work Restrictions */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedInstallationConstraintCategory((prev) => (prev === 'work' ? null : 'work'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Work Restrictions</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getWorkRestrictionsImpact().badgeClass}`}>
                                {getWorkRestrictionsImpact().label}
                              </span>
                              <i className={`fas fa-chevron-down transition-transform ${expandedInstallationConstraintCategory === 'work' ? 'rotate-180' : ''}`}></i>
                            </div>
                          </button>
                          {expandedInstallationConstraintCategory === 'work' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Working Hours</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Daytime', 'Night Shift Only', 'Limited Hours'] as const).map((v) => {
                                    const selected = installationConstraints.workingHours === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, workingHours: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Noise Restrictions</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.noiseRestrictions === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, noiseRestrictions: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Work Interruptions</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['None', 'Occasional', 'Frequent'] as const).map((v) => {
                                    const selected = installationConstraints.workInterruptions === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, workInterruptions: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Permits & Compliance */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInstallationConstraintCategory((prev) => (prev === 'permits' ? null : 'permits'))
                            }
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Permits &amp; Compliance</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getPermitsImpact().badgeClass}`}>
                                {getPermitsImpact().label}
                              </span>
                              <i className={`fas fa-chevron-down transition-transform ${expandedInstallationConstraintCategory === 'permits' ? 'rotate-180' : ''}`}></i>
                            </div>
                          </button>
                          {expandedInstallationConstraintCategory === 'permits' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Permit Required</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.permitRequired === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, permitRequired: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Safety Requirements</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['PPE Only', 'With Safety Officer'] as const).map((v) => {
                                    const selected = installationConstraints.safetyRequirements === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, safetyRequirements: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Site Induction Required</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.siteInductionRequired === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, siteInductionRequired: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Accessibility */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedInstallationConstraintCategory((prev) => (prev === 'access' ? null : 'access'))}
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Accessibility</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getAccessibilityImpact().badgeClass}`}>
                                {getAccessibilityImpact().label}
                              </span>
                              <i className={`fas fa-chevron-down transition-transform ${expandedInstallationConstraintCategory === 'access' ? 'rotate-180' : ''}`}></i>
                            </div>
                          </button>
                          {expandedInstallationConstraintCategory === 'access' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Site Accessibility</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Easy', 'Moderate', 'Difficult'] as const).map((v) => {
                                    const selected = installationConstraints.siteAccessibility === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, siteAccessibility: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Elevator Access</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.elevatorAccess === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, elevatorAccess: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stair Access Only</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.stairAccessOnly === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, stairAccessOnly: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Installation Complexity */}
                        <div className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInstallationConstraintCategory((prev) => (prev === 'complexity' ? null : 'complexity'))
                            }
                            className="w-full flex items-center justify-between px-4 py-3 min-h-[2.75rem] text-left font-black text-[10px] uppercase tracking-widest text-blue-900 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span>Installation Complexity</span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getInstallationComplexityImpact().badgeClass}`}>
                                {getInstallationComplexityImpact().label}
                              </span>
                              <i className={`fas fa-chevron-down transition-transform ${expandedInstallationConstraintCategory === 'complexity' ? 'rotate-180' : ''}`}></i>
                            </div>
                          </button>
                          {expandedInstallationConstraintCategory === 'complexity' && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Working at Height</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.workingAtHeight === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, workingAtHeight: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Special Equipment Needed</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {(['Ladder', 'Scaffolding', 'Boom Lift'] as const).map((v) => {
                                    const selected = installationConstraints.specialEquipmentNeeded === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, specialEquipmentNeeded: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Size Limitation</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(['Yes', 'No'] as const).map((v) => {
                                    const selected = installationConstraints.teamSizeLimitation === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setInstallationConstraints((prev) => ({ ...prev, teamSizeLimitation: v }))}
                                        className={`w-full px-3 py-1.5 rounded-xl border-2 transition ${
                                          selected
                                            ? 'bg-blue-900 border-blue-900 text-white'
                                            : 'bg-white border-slate-200 text-blue-900 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`text-[11px] ${selected ? 'font-black' : 'font-bold'}`}>{v}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowSiteConstraintsModal(false)}
                className="w-full py-3 bg-white border-2 border-blue-900 text-blue-900 font-black rounded-xl text-[11px] uppercase tracking-widest active:scale-[0.98] transition hover:bg-blue-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY RECOUNT / FULL REVIEW MODAL */}
      {showInventoryRecountModal && (
        <div className="fixed inset-0 z-[108] bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowInventoryRecountModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-white text-blue-900 flex justify-between items-center shrink-0 border-b border-slate-100">
              <h3 className="font-black uppercase tracking-widest text-xs">Survey Review</h3>
              <button onClick={() => setShowInventoryRecountModal(false)} className="text-slate-400 hover:text-blue-900 transition touch-target" aria-label="Close">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto text-sm">
              {/* Project */}
              <section>
                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Project</h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-slate-700">
                  <p><span className="font-bold text-slate-500">Name:</span> {project.name}</p>
                  <p><span className="font-bold text-slate-500">Client:</span> {project.clientName}</p>
                  {canViewSensitiveClientInfo && (
                    <p><span className="font-bold text-slate-500">Contact:</span> {project.clientContact}</p>
                  )}
                  {canViewSensitiveClientInfo && (
                    <p><span className="font-bold text-slate-500">Email:</span> {project.clientEmail}</p>
                  )}
                  {(project.locationName || project.location) && (
                    <p><span className="font-bold text-slate-500">Location:</span> {project.locationName || project.location}</p>
                  )}
                  <p><span className="font-bold text-slate-500">Technician:</span> {project.technicianName}</p>
                  <p><span className="font-bold text-slate-500">Date:</span> {project.date}</p>
                </div>
              </section>
              {/* Survey type & inventory */}
              <section>
                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Survey & Inventory</h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <p><span className="font-bold text-slate-500">System:</span> {type}</p>
                  {type === SurveyType.CCTV && cctvData && (
                    <>
                      <p><span className="font-bold text-slate-500">Units:</span> {cctvData.cameras.length}</p>
                      <p><span className="font-bold text-slate-500">Total Cabling:</span> {cctvData.cameras.reduce((s, c) => s + c.cableLength, 0)}m</p>
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Cameras</p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {cctvData.cameras.map((cam) => (
                            <li key={cam.id} className="pl-2 border-l-2 border-blue-200">
                              <span className="font-bold">{cam.locationName}</span> — {cam.type}, {cam.resolution}, {cam.purposes.join(', ')}, {cam.environment}, {cam.lightingCondition}, mount {cam.mountingHeight}m, {cam.cableType} {cam.cableLength}m
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  {type === SurveyType.FIRE_ALARM && faData && (
                    <>
                      <p><span className="font-bold text-slate-500">Zones:</span> {faData.detectionAreas.length}</p>
                      <p><span className="font-bold text-slate-500">Detectors:</span> {faData.detectionAreas.reduce((acc, area) => acc + area.devices.reduce((dAcc, d) => dAcc + d.count, 0), 0)}</p>
                      <p><span className="font-bold text-slate-500">System:</span> {faData.systemType || '—'}</p>
                      <p><span className="font-bold text-slate-500">Cable:</span> {faData.infrastructure?.cableType || '—'} {faData.infrastructure?.cableLength ?? 0}m</p>
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Detection areas & devices</p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {faData.detectionAreas.map((area) => (
                            <li key={area.id} className="pl-2 border-l-2 border-blue-200">
                              <span className="font-bold">{area.name}</span>
                              <ul className="ml-3 mt-0.5 space-y-0.5">
                                {area.devices.map((dev, j) => (
                                  <li key={j}>{dev.type}{dev.otherType ? ` (${dev.otherType})` : ''} × {dev.count}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  {type === SurveyType.ACCESS_CONTROL && acData && (
                    <>
                      <p><span className="font-bold text-slate-500">Doors:</span> {acData.doors.length}</p>
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Door entries</p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {acData.doors.map((door) => (
                            <li key={door.id} className="pl-2 border-l-2 border-blue-200">
                              <span className="font-bold">{door.name}</span> — {door.location}, {door.doorType || '—'} {door.operation || '—'}, {door.accessMethod?.join(', ') || '—'}, {door.lockType || '—'} {door.environment || '—'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  {type === SurveyType.BURGLAR_ALARM && baData && (
                    <>
                      <p><span className="font-bold text-slate-500">Sensors:</span> {baData.sensors.length} (total count: {baData.sensors.reduce((s, x) => s + x.count, 0)})</p>
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Sensor entries</p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {baData.sensors.map((sensor) => (
                            <li key={sensor.id} className="pl-2 border-l-2 border-blue-200">
                              <span className="font-bold">{sensor.location}</span> — {sensor.type || '—'}, ×{sensor.count}, {sensor.connection || '—'}, {sensor.riskLevel || '—'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  {type === SurveyType.FIRE_PROTECTION && fpData && (
                    <>
                      <p><span className="font-bold text-slate-500">Protection units:</span> {(fpData.protectionUnits ?? []).length}</p>
                      {(fpData.protectionUnits ?? []).length > 0 && (
                        <div className="border-t border-slate-200 pt-2 mt-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Unit details</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            {(fpData.protectionUnits ?? []).map((u, i) => (
                              <li key={u.id ?? i} className="pl-2 border-l-2 border-blue-200">
                                <span className="font-bold">{u.protectionArea || u.otherProtectionArea || 'Area'}</span> — Hazard: {u.hazardClassification || '—'}, Systems: {u.scope?.systems?.join(', ') || '—'}, Smoke×{u.alarmCore?.smokeCount ?? 0} Heat×{u.alarmCore?.heatCount ?? 0} MCP×{u.alarmCore?.mcpCount ?? 0} Notif×{u.alarmCore?.notifCount ?? 0}, Suppression: {u.suppression?.type || '—'}×{u.suppression?.qty ?? 0}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {type === SurveyType.OTHER && otherData && (
                    <>
                      <p><span className="font-bold text-slate-500">Category:</span> {otherData.systemCategory || otherData.otherSystemCategory || '—'}</p>
                      <p><span className="font-bold text-slate-500">Scope:</span> {otherData.scopeOfWork || otherData.otherScopeOfWork || '—'}</p>
                      <p><span className="font-bold text-slate-500">Coverage:</span> {otherData.coverageArea || otherData.otherCoverageArea || '—'}</p>
                      <p><span className="font-bold text-slate-500">Service details:</span> {otherData.serviceDetails || '—'}</p>
                      {canViewCosting && otherData.estimatedCost != null && <p><span className="font-bold text-slate-500">Estimated cost:</span> {formatCurrency(otherData.estimatedCost)}</p>}
                      {canViewCosting && otherData.cablesCost != null && <p><span className="font-bold text-slate-500">Cables cost:</span> {formatCurrency(otherData.cablesCost)}</p>}
                    </>
                  )}
                </div>
              </section>
              {/* Consumables */}
              <section>
                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Consumables</h4>
                <div className="bg-slate-50 rounded-xl p-4">
                  {consumablesList.length === 0 ? (
                    <p className="text-slate-400 text-xs uppercase">None listed</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {consumablesList.map((entry) => (
                        <li key={entry.id} className="flex justify-between text-slate-700">
                          <span>{entry.name}</span>
                          <span className="font-bold">×{entry.qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              {/* Manpower */}
              <section>
                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Phase Effort</h4>
                <div className="bg-slate-50 rounded-xl p-4">
                  {manpowerBreakdown.length === 0 ? (
                    <p className="text-slate-400 text-xs uppercase">No manpower assigned</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {manpowerBreakdown.map((entry) => (
                        <li key={entry.id} className="flex justify-between text-slate-700">
                          <span>{entry.role} – {entry.hours} HRS</span>
                          <span className="font-bold">×{entry.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">Total: {totalManDays.toFixed(2)} Man-Days</p>
                </div>
              </section>
              {canViewCosting && (
                <section>
                  <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Cost Summary</h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                    <div className="flex justify-between text-slate-700"><span>Hardware</span><span className="font-mono">{formatCurrency(costs.equipment)}</span></div>
                    <div className="flex justify-between text-slate-700"><span>Cabling</span><span className="font-mono">{formatCurrency(costs.cables)}</span></div>
                    <div className="flex justify-between text-slate-700"><span>Consumables Total</span><span className="font-mono">{formatCurrency(consumablesTotal)}</span></div>
                    <div className="flex justify-between text-slate-700"><span>Labor</span><span className="font-mono">{formatCurrency(costs.labor)}</span></div>
                    {additionalFees.length > 0 && (
                      <>
                        <div className="pt-1.5 border-t border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Additional fees (Inventory Recount)</p>
                          {additionalFees.map((f) => (
                            <div key={f.id} className="flex justify-between text-slate-700"><span>{f.type}</span><span className="font-mono">{formatCurrency(f.amount)}</span></div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-slate-400 text-sm pt-2 border-t border-slate-200"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between text-slate-400 text-sm"><span>VAT (12%)</span><span className="font-mono">{formatCurrency(tax)}</span></div>
                    <div className="flex justify-between text-blue-900 font-black pt-1"><span>Estimated ({type})</span><span className="font-mono text-lg">{formatCurrency(total)}</span></div>
                  </div>
                </section>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowInventoryRecountModal(false)} className="w-full py-3 bg-blue-900 text-white font-black rounded-xl text-[11px] uppercase tracking-widest active:scale-[0.98] transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimationScreen;