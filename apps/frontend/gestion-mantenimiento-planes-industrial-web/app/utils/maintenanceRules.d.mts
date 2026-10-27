import type {
  Plan,
  PlanParameters,
  PlanTask,
  Severity,
  Task,
  NewTaskInput,
  SessionUser,
} from "../types/maintenance";

export const SEVERITIES: Severity[];
export const MAINTENANCE_TYPES: string[];

export function normalize(value: unknown): string;

export function isDuplicateTask(
  candidate: Pick<NewTaskInput, "name" | "system" | "line">,
  tasks: Task[],
  excludeId?: string,
): boolean;

export function findSimilarTasks(
  candidate: Pick<NewTaskInput, "name" | "system" | "line">,
  tasks: Task[],
  excludeId?: string,
): Task[];

export function validateTaskDraft(draft: Partial<NewTaskInput>): string[];

export type GenerationParamsInput = {
  total: number;
  preventive: number;
  corrective: number;
  predictive: number;
  systems: string[];
  balance: number;
};

export function validateGenerationParams(
  params: GenerationParamsInput,
  availableCount?: number,
): string[];

export function suggestTaskSelection(
  tasks: Task[],
  params: GenerationParamsInput,
): string[];

export function buildPlanParams(
  tasks: Task[] | PlanTask[],
  target: PlanParameters["target"],
): PlanParameters;

export function balanceScore(
  tasks: Task[],
  target: PlanParameters["target"],
): number;

export function findOperatorConflict(
  operatorName: string,
  planId: string,
  plans: Plan[],
): Plan | null;

export function visiblePlansFor(
  user: Pick<SessionUser, "role" | "lines" | "name"> | null,
  plans: Plan[],
): Plan[];

export function sortRows<T>(rows: T[], key: string, asc?: boolean): T[];

export function filterTasks(
  tasks: Task[],
  filters?: {
    query?: string;
    line?: string;
    type?: string;
    severity?: string;
  },
): Task[];

export type AutomaticPlanRow = {
  id: string;
  name: string;
  line: string;
  creator: string;
  createdAt: string;
  total: number;
  mix: string;
  systems: string;
  balance: number;
};

export function buildAutomaticPlansReport(
  plans: Plan[],
  line?: string,
): AutomaticPlanRow[];

export type ReviewerPlanRow = {
  id: string;
  name: string;
  line: string;
  reviewer: string;
  validatedAt: string;
  observations: string;
  status: string;
};

export function buildReviewerReport(
  plans: Plan[],
  reviewer?: string,
): ReviewerPlanRow[];

export function listReviewers(plans: Plan[]): string[];

export function executionStats(plans: Plan[]): {
  total: number;
  completed: number;
  rate: number;
};
