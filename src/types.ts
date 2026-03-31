/**
 * CORE DATA TYPES FOR AA2000 SITE SURVEY APP
 */

export enum SurveyType {
  CCTV = 'CCTV',
  FIRE_ALARM = 'Fire Alarm',
  ACCESS_CONTROL = 'Access Control',
  BURGLAR_ALARM = 'Burglar Alarm',
  FIRE_PROTECTION = 'Fire Protection',
  OTHER = 'Other'
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  clientContact: string;
  location: string;
  /** User-defined name for the project location (e.g. "Main Office", "Site A"). */
  locationName?: string;
  /** Project schedule start date (YYYY-MM-DD). */
  startDate?: string;
  /** Assigned technicians for this project. */
  assignedTechnicians?: Array<{ fullName: string; email: string }>;
  /** Response per assigned technician email: ACCEPTED or DECLINED. */
  technicianResponses?: Record<string, 'ACCEPTED' | 'DECLINED'>;
  /** Required manpower count assigned during project setup. */
  requiredTechnicians?: number;
  status: 'In Progress' | 'Completed';
  technicianName: string;
  date: string;
}

/** Single manpower entry for estimation phase effort (role, count, hours). */
export interface EstimationManpowerEntry {
  id: string;
  role: string;
  count: number;
  hours: number;
}

/** Single consumable entry for estimation materials. */
export interface EstimationConsumableEntry {
  id: string;
  name: string;
  category: string;
  qty: number;
  unitPrice?: number;
}

/** Single additional fee line item for estimation (e.g. Travel Fee). */
export interface EstimationAdditionalFeeEntry {
  id: string;
  type: string;
  amount: number;
}

/** Stored per survey type when finalizing; includes optional breakdown for edit reload. */
export interface EstimationDetail {
  days: number;
  techs: number;
  manpowerBreakdown?: EstimationManpowerEntry[];
  consumablesList?: EstimationConsumableEntry[];
  additionalFees?: EstimationAdditionalFeeEntry[];
  /** Summary strings from Site Constraints (Physical, Electrical, Installation) for detailed audit. */
  siteConstraintPhysical?: string;
  siteConstraintElectrical?: string;
  siteConstraintInstallation?: string;
}

export interface CameraEntry {
  id: string;
  locationName: string;
  purposes: string[];
  type: 'Dome' | 'Bullet' | 'PTZ' | 'Fisheye';
  resolution: string;
  lightingCondition: 'Good Lighting' | 'Low Light' | 'No Light';
  environment: 'Indoor' | 'Outdoor';
  mountingHeight: number;
  /** Viewing/coverage distance in meters (how far the camera needs to cover). */
  coverageDistanceMeters?: number;
  /** Scope status: same options as Fire Protection survey. */
  scopeStatus: 'New Installation' | 'Expansion' | 'Replacement' | '';
  cableType: 'Cat5e' | 'Cat6' | 'Cat6a' | 'Fiber' | 'Coaxial' | 'Other';
  otherCableType?: string;
  cableLength: number;
}

export interface RoomEntry {
  id: string;
  name: string;
  length: number;
  width: number;
  area: number;
}

export interface BuildingMeasurements {
  method: 'PLAN_UPLOAD' | 'MANUAL_ROOMS';
  planImage?: string;
  /** Multiple floor plan files (e.g. one per floor). AI analyzes all. */
  planImages?: string[];
  planScale?: {
    knownDimensionMeters: number;
  };
  rooms: RoomEntry[];
  totalArea: number;
}

export interface CCTVSurveyData {
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  cameras: CameraEntry[];
  infrastructure: {
    cablePath: 'Ceiling' | 'Trunking' | 'Open Cable' | 'Other' | '';
    otherCablePath?: string;
    wallType: 'Concrete' | 'Gypsum' | 'Glass' | 'Steel' | 'Brick' | 'Other' | '';
    otherWallType?: string;
    coreDrilling: boolean;
  };
  controlRoom: {
    nvrLocation: string;
    /** Estimated storage requirement in TB for NVR recording. */
    storageRequirementTB?: number;
    /** Recording retention in days (e.g. 7, 14, 30, 90). */
    retentionDays?: number;
    rackAvailable?: boolean;
    powerSocketAvailable?: boolean;
    upsRequired?: boolean;
    networkSwitchAvailable?: boolean;
    internetAvailable?: boolean;
  };
}

export interface DetectionDevice {
  type: 'Smoke' | 'Heat' | 'Flame' | 'Gas' | 'Multi-sensor' | 'Other';
  /** When type === 'Other', the user-specified detector type label. */
  otherType?: string;
  count: number;
}

export interface DetectionArea {
  id: string;
  name: string;
  devices: DetectionDevice[];
  image?: string;
  ceilingType?: string;
  ceilingHeight?: number;
  notificationAppliance?: string;
  audibilityRequirement?: string;
  notificationQty?: number;
  existingSystemStatus?: string;
}

export interface FireAlarmSurveyData {
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  systemType: 'Conventional' | 'Addressable' | 'Wireless' | '';
  integrations: string[];
  detectionAreas: DetectionArea[];
  notification: {
    mcpRequired: boolean;
    mcpCount: number;
    devices: string[];
    deviceCount: number;
  };
  infrastructure: {
    cableType: string;
    otherCableType?: string;
    cableLength: number;
    routing: string;
    otherRouting?: string;
    wallType: 'Concrete' | 'Gypsum' | 'Brick' | 'Steel' | '';
    coreDrilling: boolean;
  };
  controlPanel: {
    location: string;
    rackAvailable?: boolean;
    powerAvailable?: boolean;
    upsRequired?: boolean;
    networkRequired?: boolean;
  };
}

/** One saved "Fire Protection" entry (protection area + scope + suppression/sprinkler details). */
export interface FireProtectionUnit {
  id: string;
  protectionArea?: string;
  otherProtectionArea?: string;
  hazardClassification?: string;
  scope: FireProtectionSurveyData['scope'];
  alarmCore: FireProtectionSurveyData['alarmCore'];
  suppression: FireProtectionSurveyData['suppression'];
  sprinkler: FireProtectionSurveyData['sprinkler'];
  siteImage?: string;
  siteConstraints: FireProtectionSurveyData['siteConstraints'];
  buildingInfoArea: number;
  fireExtinguisher?: FireProtectionSurveyData['fireExtinguisher'];
  fireHoseReel?: FireProtectionSurveyData['fireHoseReel'];
  fireBlanket?: FireProtectionSurveyData['fireBlanket'];
  emergencyLighting?: FireProtectionSurveyData['emergencyLighting'];
  exitEvacuation?: FireProtectionSurveyData['exitEvacuation'];
}

export interface FireProtectionSurveyData {
  /** List of saved protection units (Details step). */
  protectionUnits?: FireProtectionUnit[];
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    area: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  siteImage?: string;
  protectionArea?: string;
  otherProtectionArea?: string;
  hazardClassification?: string;
  scope: {
    systems: ('Fire Alarm' | 'Suppression' | 'Sprinkler' | 'Portable')[];
    status: 'New Installation' | 'Expansion' | 'Replacement' | '';
  };
  alarmCore: {
    type: 'Addressable' | 'Conventional' | '';
    panelLocation: string;
    powerAvailable?: boolean;
    batteryRequired?: boolean;
    smokeCount: number;
    heatCount: number;
    mcpCount: number;
    notifCount: number;
  };
  zoning: {
    zones: number;
    highRiskAreas: ('Electrical' | 'Server' | 'Kitchen' | 'Warehouse')[];
  };
  infrastructure: {
    cableType: 'Fire-rated' | 'Standard' | '';
    cableLength: number;
    conduitsExist?: boolean;
  };
  suppression: {
    type: 'ABC' | 'CO2' | 'K-Type' | '';
    qty: number;
    locationIdentified?: boolean;
    coverageType?: string;
    cylinderLocAvailable?: boolean;
    nozzleCount: number;
    sealingCondition?: string;
  };
  sprinkler: {
    coverageArea: number;
    waterSource: string;
    otherWaterSource?: string;
    pumpRoomAvailable?: boolean;
    existingStatus?: string;
    headType?: string;
    tempRating?: string;
    pipeMaterial?: string;
    otherPipeMaterial?: string;
    pipeRouting?: string;
    pipeLength?: number;
  };
  integration: {
    systems: ('CCTV' | 'Access Control')[];
    bfpCompliance?: boolean;
  };
  siteConstraints: {
    ceilingHeight: number;
    ceilingType: 'Concrete' | 'Gypsum' | 'Glass' | 'Steel' | 'Brick' | 'Other' | '';
    otherCeilingType?: string;
    isOccupied?: boolean;
  };
  controlRoom?: {
    name: string;
    floorLevel: string;
    distanceToArea: number;
    panelInstalled?: 'Yes' | 'No' | 'Existing';
    panelType?: 'Dedicated suppression panel' | 'Integrated with FACP';
    releaseMethod?: 'Automatic' | 'Manual' | 'Combined';
    powerSupplyAvailable?: boolean;
    upsBackupProvided?: boolean;
  };
  /** Portable fire extinguishers */
  fireExtinguisher?: {
    type: 'ABC' | 'CO2' | 'Water' | 'Foam' | 'K-Class' | 'Other' | '';
    otherType?: string;
    quantity: number;
    capacity: '2.5 kg' | '5 kg' | '6 kg' | '9 L' | '20 L' | 'Other' | '';
    otherCapacity?: string;
    mountingType: 'Wall-mounted' | 'Cabinet' | 'Stand' | '';
    lastServiceDate?: string;
    bfpCompliant?: boolean;
  };
  /** Fire hose / hose reels */
  fireHoseReel?: {
    quantity: number;
    hoseLengthM: number;
    nozzleType: 'Jet' | 'Spray' | 'Jet/Spray' | 'Fog' | 'Straight stream' | 'Other' | '';
    otherNozzleType?: string;
  };
  /** Fire blankets */
  fireBlanket?: {
    quantity: number;
    locations?: string;
  };
  /** Emergency lighting */
  emergencyLighting?: {
    present: boolean;
    type?: 'Maintained' | 'Non-maintained' | '';
  };
  /** Exit / evacuation */
  exitEvacuation?: {
    exitSignsQuantity: number;
    evacuationLightingPresent: boolean;
  };
}

export interface OtherSurveyData {
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  siteImage?: string;
  systemCategory?: string;
  otherSystemCategory?: string;
  scopeOfWork?: string;
  otherScopeOfWork?: string;
  coverageArea?: string;
  otherCoverageArea?: string;
  serviceDetails: string;
  estimatedCost?: number;
  ceilingType?: string;
  otherCeilingType?: string;
  materialsCost?: number;
  cablesCost?: number;
}

export interface AccessControlDoor {
  id: string;
  name: string;
  location: string;
  doorType?: 'Single' | 'Double';
  operation?: 'Swinging' | 'Sliding' | 'Revolving' | 'Rolling';
  doorAutomation?: 'Manual' | 'Automated';
  accessMethod: string[];
  accessMethodCapacity: string;
  lockType?: 'Electric strike' | 'Magnetic lock' | 'Mechanical lock' | 'Dropbolt';
  lockPowerType?: '12V' | '24V' | 'PoE' | '';
  wireType: string;
  doorMaterial?: 'Wood' | 'Metal' | 'Glass';
  rexType?: 'Push Button' | 'No-Touch Sensor' | 'Emergency Breakglass';
  environment?: 'Indoor' | 'Outdoor';
  wallType?: 'Concrete' | 'Gypsum' | 'Glass' | 'Steel' | 'Brick' | 'Other';
  otherWallType?: string;
  mountingSurface?: string;
  otherMountingSurface?: string;
  image?: string;
}

export interface AccessControlSurveyData {
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  doors: AccessControlDoor[];
  infrastructure: {
    cableType: 'Cat6' | 'Multi-core' | 'Shielded' | '';
    cablePath: 'Ceiling' | 'Trunking' | 'Underground' | '';
    powerPath: 'Separate' | 'Shared' | '';
  };
  controller: {
    location: string;
    estimatedCableLength?: number;
    poeAvailable?: boolean;
    redundantControllers?: boolean;
    additionalHardware: string;
    wiringNotes: string;
    powerAvailable?: boolean;
    upsRequired?: boolean;
    networkRequired?: boolean;
    fireRatedDoor?: boolean;
  };
}

export interface BurglarAlarmSensor {
  id: string;
  location: string;
  riskLevel?: 'Low' | 'Medium' | 'High';
  intrusionConcern?: string[];
  environment?: 'Indoor' | 'Outdoor';
  type?: string;
  obstructions?: string[];
  count: number;
  connection?: 'Wired' | 'Wireless';
  wallType?: string;
  otherWallType?: string;
  image?: string;
}

export interface BurglarAlarmSurveyData {
  buildingInfo: {
    type: string;
    otherType?: string;
    floors: number;
    isNew: boolean;
  };
  measurements?: BuildingMeasurements;
  sensors: BurglarAlarmSensor[];
  notification: {
    sirenIndoor: number;
    sirenOutdoor: number;
    strobeLight?: boolean;
  };
  controlPanel: {
    location: string;
    systemType: 'Hybrid' | 'Fully Wireless' | 'Fully Wired' | '';
    keypads: number;
    simCardRequired?: boolean;
    internetRequired?: boolean;
    sirenLocation?: string;
    sirenTypeRequired?: 'Internal' | 'External' | '';
    monitoringType?: 'Self-Monitoring' | 'Central Monitoring' | '';
    notificationMethod?: string[];
    petsPresent?: boolean;
    powerSourceAvailable?: boolean;
    cableRoutingPath?: string;
    otherCableRoutingPath?: string;
    estimatedCableLength?: number;
  };
}

export interface User {
  fullName: string;
  email: string;
  password?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
