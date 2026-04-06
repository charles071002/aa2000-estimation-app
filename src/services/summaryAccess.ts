import {
  Project,
  SurveyType,
  EstimationDetail,
  CCTVSurveyData,
  FireAlarmSurveyData,
  FireProtectionSurveyData,
  AccessControlSurveyData,
  BurglarAlarmSurveyData,
  OtherSurveyData,
} from '../types';

export type SummaryVisibilityRole = 'TECHNICIAN' | 'ADMIN' | null;

export interface SummaryRecordView {
  project: Project;
  cctvData: CCTVSurveyData | null;
  faData: FireAlarmSurveyData | null;
  fpData: FireProtectionSurveyData | null;
  acData: AccessControlSurveyData | null;
  baData: BurglarAlarmSurveyData | null;
  otherData: OtherSurveyData | null;
  estimations: Record<string, EstimationDetail>;
}

const SENSITIVE_ESTIMATION_KEYS = new Set<string>([
  SurveyType.CCTV,
  SurveyType.FIRE_ALARM,
  SurveyType.FIRE_PROTECTION,
  SurveyType.ACCESS_CONTROL,
  SurveyType.BURGLAR_ALARM,
  SurveyType.OTHER,
]);

/**
 * Data-layer guard for summary payload.
 * Technicians get technical-only summary fields.
 */
export function toSummaryViewByRole(
  data: SummaryRecordView,
  role: SummaryVisibilityRole
): SummaryRecordView {
  if (role !== 'TECHNICIAN') return data;

  const project: Project = {
    ...data.project,
    clientContact: '',
    clientEmail: '',
  };

  const estimations = Object.entries(data.estimations || {}).reduce<Record<string, EstimationDetail>>(
    (acc, [key, est]) => {
      if (!SENSITIVE_ESTIMATION_KEYS.has(key) || !est) {
        acc[key] = est;
        return acc;
      }
      acc[key] = {
        ...est,
        consumablesList: [],
        additionalFees: [],
      };
      return acc;
    },
    {}
  );

  const otherData = data.otherData
    ? {
        ...data.otherData,
        estimatedCost: undefined,
        materialsCost: undefined,
        cablesCost: undefined,
      }
    : null;

  return {
    ...data,
    project,
    estimations,
    otherData,
  };
}
