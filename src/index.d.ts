// Public type declarations for ahmad-awais-deepseek-v4-toolrepair.
// Mirrors src/index.js (CommonJS). Hand-written to avoid a build step on a zero-dep library.

export type SchemaFieldType = 'string' | 'array' | 'path' | 'number' | 'boolean' | 'object';

// Trailing `!` marks a required field (e.g. `"path!"`).
export type ToolSchema = Record<string, string>;

export interface ValidationError {
  path: string;
  expected: string;
  received: string;
}

export interface AppliedFix {
  type: string;
  path?: string;
  fields?: string[];
  notes?: string[];
}

export interface RepairResult {
  repaired: boolean;
  input: unknown;
  fixes: AppliedFix[];
  errors: ValidationError[];
  passThrough: boolean;
  retryMessage?: string;
}

export interface ShapeFixResult {
  fixed: boolean;
  input: unknown;
  fix?: string | null;
}

export interface AutolinkValueResult {
  fixed: boolean;
  value: unknown;
  fix?: 'autolink';
}

export interface AutolinkFixResult {
  fixed: boolean;
  input: unknown;
  fixes: string[];
  fix: 'autolink';
}

export interface RelationalFixResult {
  repaired: boolean;
  input: unknown;
  notes?: string[];
  fix?: string;
}

export interface TelemetryRecord {
  tool: string;
  repaired: boolean;
  passThrough: boolean;
  fixes?: AppliedFix[];
  errors?: ValidationError[];
}

export interface RepairApi {
  validateAndRepair(toolName: string, toolInput: unknown): RepairResult;
  generateRetryMessage(toolName: string, errors: ValidationError[], fixes: AppliedFix[]): string;
  logTelemetry(telemetry: TelemetryRecord): void;
  validateField(input: unknown, schema: ToolSchema): ValidationError[];
  getSchema(toolName: string): ToolSchema | undefined;
}

export interface ShapeFixesApi {
  removeNulls(input: unknown): ShapeFixResult;
  parseJsonArray(input: unknown, path: string): ShapeFixResult;
  wrapSingleObject(input: unknown, path: string): ShapeFixResult;
  wrapBareString(input: unknown, path: string): ShapeFixResult;
  applyFixesForPath(input: unknown, path: string, expectedType: SchemaFieldType): ShapeFixResult;
}

export interface AutolinkFixApi {
  fixMarkdownAutolink(value: unknown): AutolinkValueResult;
  fixAutolinksInPaths(input: unknown, schema?: ToolSchema): AutolinkFixResult;
}

export interface RelationalFixApi {
  applyRelationalFixes(toolName: string, input: Record<string, unknown>): RelationalFixResult;
  fixReadFileInvariants(input: Record<string, unknown>): RelationalFixResult;
}

export const repair: RepairApi;
export const shapeFixes: ShapeFixesApi;
export const autolinkFix: AutolinkFixApi;
export const relationalFix: RelationalFixApi;

declare const _default: {
  repair: RepairApi;
  shapeFixes: ShapeFixesApi;
  autolinkFix: AutolinkFixApi;
  relationalFix: RelationalFixApi;
};
export default _default;
