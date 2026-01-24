import type {
  ExtractionCounts,
  GraphQLKind,
  GraphQLModel,
  OperationField,
  OperationSummary,
  OperationVariable,
  RequestSummary,
} from "@graphql-mapper/shared";

import { hashString } from "../utils/helpers";
import { formatFieldTypes, mergeFieldTypes } from "../utils/type-inference";

export type OperationState = {
  id: string;
  name: string;
  kind: GraphQLKind;
  signature: string;
  variables: OperationVariable[];
  fieldPaths: string[];
  fieldTypes: Map<string, Set<string>>;
  requestIds: Set<string>;
};

export const emptyCounts = (): ExtractionCounts => ({
  scanned: 0,
  inScope: 0,
  graphql: 0,
  deduped: 0,
});

export const signatureForOperation = (operation: {
  kind: GraphQLKind;
  name: string;
  variables: OperationVariable[];
  fieldPaths: string[];
}) => {
  const variablesSignature = operation.variables
    .map((variable) => `${variable.name}:${variable.type}`)
    .join(",");
  return `${operation.kind}|${operation.name}|${variablesSignature}|${operation.fieldPaths.join(",")}`;
};

const buildOperationSummary = (state: OperationState): OperationSummary => {
  const fields: OperationField[] = state.fieldPaths.map((path) => ({
    path,
    inferredType: formatFieldTypes(state.fieldTypes.get(path)),
  }));
  return {
    id: state.id,
    name: state.name,
    kind: state.kind,
    signature: state.signature,
    variables: state.variables,
    fields,
    requestIds: Array.from(state.requestIds),
  };
};

export const createOperationState = (
  operation: {
    kind: GraphQLKind;
    name: string;
    variables: OperationVariable[];
    fieldPaths: string[];
  },
  requestId: string,
): OperationState => {
  const signature = signatureForOperation(operation);
  return {
    id: `op-${hashString(signature)}`,
    name: operation.name,
    kind: operation.kind,
    signature,
    variables: operation.variables,
    fieldPaths: operation.fieldPaths,
    fieldTypes: new Map<string, Set<string>>(),
    requestIds: new Set([requestId]),
  };
};

export const updateOperationState = (
  state: OperationState,
  requestId: string,
  responseTypes?: Map<string, Set<string>>,
) => {
  state.requestIds.add(requestId);
  if (responseTypes) {
    mergeFieldTypes(state.fieldTypes, responseTypes);
  }
};

const fieldTypesFromSummary = (fields: OperationField[]) => {
  const map = new Map<string, Set<string>>();
  for (const field of fields) {
    if (field.inferredType === undefined || field.inferredType.length === 0) {
      continue;
    }
    const types = field.inferredType
      .split("|")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (types.length === 0) {
      continue;
    }
    map.set(field.path, new Set(types));
  }
  return map;
};

export const operationStateFromSummary = (
  summary: OperationSummary,
): OperationState => {
  return {
    id: summary.id,
    name: summary.name,
    kind: summary.kind,
    signature: summary.signature,
    variables: summary.variables,
    fieldPaths: summary.fields.map((field) => field.path),
    fieldTypes: fieldTypesFromSummary(summary.fields),
    requestIds: new Set(summary.requestIds),
  };
};

export const buildModel = (
  operations: Map<string, OperationState>,
  requestSummaries: Map<string, RequestSummary>,
  counts: ExtractionCounts,
): GraphQLModel => {
  return {
    operations: Array.from(operations.values())
      .map(buildOperationSummary)
      .sort((left, right) => left.name.localeCompare(right.name)),
    requests: Array.from(requestSummaries.values()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
    counts,
    updatedAt: new Date().toISOString(),
  };
};
