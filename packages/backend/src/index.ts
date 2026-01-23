import type { DefineAPI, SDK } from "caido:plugin";
import type { Cursor, Request, Response } from "caido:utils";
import { parse } from "graphql";

type Result<T> =
  | { kind: "Ok"; value: T }
  | { kind: "Error"; error: string };

type GraphQLKind = "query" | "mutation" | "subscription";

type ExtractionOptions = {
  pageSize?: number;
  maxRequests?: number;
};

type ExtractionCounts = {
  scanned: number;
  inScope: number;
  graphql: number;
  deduped: number;
};

type ExtractionStatus = {
  state: "idle" | "running" | "done" | "error";
  counts: ExtractionCounts;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

type OperationVariable = {
  name: string;
  type: string;
};

type OperationField = {
  path: string;
  inferredType?: string;
};

type OperationSummary = {
  id: string;
  name: string;
  kind: GraphQLKind;
  signature: string;
  variables: OperationVariable[];
  fields: OperationField[];
  requestIds: string[];
};

type RequestSummary = {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  createdAt: string;
};

type GraphQLModel = {
  operations: OperationSummary[];
  requests: RequestSummary[];
  counts: ExtractionCounts;
  updatedAt: string;
};

type RequestDetails = {
  id: string;
  method: string;
  url: string;
  createdAt: string;
  requestText: string;
  responseText?: string;
};

type OperationState = {
  id: string;
  name: string;
  kind: GraphQLKind;
  signature: string;
  variables: OperationVariable[];
  fieldPaths: string[];
  fieldTypes: Map<string, Set<string>>;
  requestIds: Set<string>;
};

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_REQUESTS = 5000;

const emptyCounts = (): ExtractionCounts => ({
  scanned: 0,
  inScope: 0,
  graphql: 0,
  deduped: 0,
});

const ok = <T>(value: T): Result<T> => ({ kind: "Ok", value });
const err = (message: string): Result<never> => ({ kind: "Error", error: message });

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const printTypeNode = (node: import("graphql").TypeNode): string => {
  switch (node.kind) {
    case "NamedType":
      return node.name.value;
    case "NonNullType":
      return `${printTypeNode(node.type)}!`;
    case "ListType":
      return `[${printTypeNode(node.type)}]`;
    default:
      return "Unknown";
  }
};

const collectFieldPaths = (
  selectionSet: import("graphql").SelectionSetNode,
  prefix = ""
): string[] => {
  const paths: string[] = [];
  for (const selection of selectionSet.selections) {
    if (selection.kind === "Field") {
      const fieldName = selection.name.value;
      const nextPath = prefix ? `${prefix}.${fieldName}` : fieldName;
      paths.push(nextPath);
      if (selection.selectionSet) {
        paths.push(...collectFieldPaths(selection.selectionSet, nextPath));
      }
    }
    if (selection.kind === "InlineFragment" && selection.selectionSet) {
      paths.push(...collectFieldPaths(selection.selectionSet, prefix));
    }
  }
  return paths;
};

const normalizePaths = (paths: string[]): string[] => {
  const unique = new Set(paths);
  return Array.from(unique).sort((left, right) => left.localeCompare(right));
};

const inferJsonType = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value;
};

const collectResponseFieldTypes = (
  value: unknown,
  prefix = ""
): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  const visit = (data: unknown, path: string) => {
    const type = inferJsonType(data);
    if (path) {
      const existing = map.get(path) ?? new Set<string>();
      existing.add(type);
      map.set(path, existing);
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
      for (const [key, child] of Object.entries(data)) {
        const nextPath = path ? `${path}.${key}` : key;
        visit(child, nextPath);
      }
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        visit(item, path);
      }
    }
  };
  visit(value, prefix);
  return map;
};

const mergeFieldTypes = (
  target: Map<string, Set<string>>,
  source: Map<string, Set<string>>
) => {
  for (const [path, types] of source.entries()) {
    const entry = target.get(path) ?? new Set<string>();
    for (const value of types) {
      entry.add(value);
    }
    target.set(path, entry);
  }
};

const signatureForOperation = (operation: {
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

const resolveOperationName = (
  kind: GraphQLKind,
  name: string | undefined,
  index: number
) => {
  if (name) {
    return name;
  }
  return `Anonymous ${kind} ${index + 1}`;
};

const isGraphQLJsonPayload = (payload: unknown): payload is {
  query?: string;
  operationName?: string;
  variables?: Record<string, unknown>;
} => {
  return typeof payload === "object" && payload !== null;
};

const parseGraphQLRequest = (request: Request) => {
  const contentType = request.getHeader("content-type")?.join(";") ?? "";
  const bodyText = request.getBody()?.toText();
  if (contentType.includes("application/graphql") && bodyText) {
    return { query: bodyText };
  }
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as unknown;
      if (isGraphQLJsonPayload(parsed) && typeof parsed.query === "string") {
        return {
          query: parsed.query,
          operationName: parsed.operationName,
          variables: parsed.variables,
        };
      }
    } catch {
      return null;
    }
  }
  if (request.getMethod() === "GET") {
    const queryString = request.getQuery();
    const queryParam = new URLSearchParams(queryString).get("query");
    if (queryParam) {
      return { query: queryParam };
    }
  }
  return null;
};

const parseResponseJson = (response?: Response) => {
  if (!response) {
    return null;
  }
  const bodyText = response.getBody()?.toText();
  if (!bodyText) {
    return null;
  }
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
      return (parsed as Record<string, unknown>).data;
    }
    return parsed;
  } catch {
    return null;
  }
};

const formatFieldTypes = (types?: Set<string>) => {
  if (!types || types.size === 0) {
    return undefined;
  }
  return Array.from(types).sort().join(" | ");
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

const createOperationState = (
  operation: {
    kind: GraphQLKind;
    name: string;
    variables: OperationVariable[];
    fieldPaths: string[];
  },
  requestId: string
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

const updateOperationState = (
  state: OperationState,
  requestId: string,
  responseTypes?: Map<string, Set<string>>
) => {
  state.requestIds.add(requestId);
  if (responseTypes) {
    mergeFieldTypes(state.fieldTypes, responseTypes);
  }
};

const parseOperations = (
  query: string
): { kind: GraphQLKind; name: string; variables: OperationVariable[]; fieldPaths: string[] }[] => {
  const document = parse(query);
  const operations: {
    kind: GraphQLKind;
    name: string;
    variables: OperationVariable[];
    fieldPaths: string[];
  }[] = [];

  let operationIndex = 0;
  for (const definition of document.definitions) {
    if (definition.kind !== "OperationDefinition") {
      continue;
    }
    const kind = definition.operation;
    const name = resolveOperationName(kind, definition.name?.value, operationIndex);
    operationIndex += 1;
    const variables =
      definition.variableDefinitions?.map((variable) => ({
        name: variable.variable.name.value,
        type: printTypeNode(variable.type),
      })) ?? [];
    const fieldPaths = normalizePaths(
      collectFieldPaths(definition.selectionSet ?? { kind: "SelectionSet", selections: [] })
    );
    operations.push({ kind, name, variables, fieldPaths });
  }
  return operations;
};

let currentStatus: ExtractionStatus = {
  state: "idle",
  counts: emptyCounts(),
};

let currentModel: GraphQLModel | null = null;

const extractInScopeRequests = async (
  sdk: SDK,
  options?: ExtractionOptions
): Promise<Result<ExtractionStatus>> => {
  if (currentStatus.state === "running") {
    return err("Extraction already in progress");
  }

  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const startedAt = new Date().toISOString();

  currentStatus = {
    state: "running",
    counts: emptyCounts(),
    startedAt,
  };

  try {
    const operations = new Map<string, OperationState>();
    const requestSummaries = new Map<string, RequestSummary>();
    let cursor: Cursor | undefined;

    while (currentStatus.counts.scanned < maxRequests) {
      const query = sdk.requests
        .query()
        .first(pageSize)
        .descending("req", "created_at");
      if (cursor) {
        query.after(cursor);
      }

      const connection = await query.execute();
      if (connection.items.length === 0) {
        break;
      }

      for (const item of connection.items) {
        if (currentStatus.counts.scanned >= maxRequests) {
          break;
        }
        currentStatus.counts.scanned += 1;
        const inScope = sdk.requests.inScope(item.request);
        if (!inScope) {
          continue;
        }
        currentStatus.counts.inScope += 1;

        const payload = parseGraphQLRequest(item.request);
        if (!payload) {
          continue;
        }

        currentStatus.counts.graphql += 1;
        const requestId = item.request.getId();
        if (!requestSummaries.has(requestId)) {
          requestSummaries.set(requestId, {
            id: requestId,
            method: item.request.getMethod(),
            url: item.request.getUrl(),
            host: item.request.getHost(),
            path: item.request.getPath(),
            createdAt: item.request.getCreatedAt().toISOString(),
          });
        }

        let operationsForRequest: {
          kind: GraphQLKind;
          name: string;
          variables: OperationVariable[];
          fieldPaths: string[];
        }[] = [];

        try {
          operationsForRequest = parseOperations(payload.query);
        } catch (error) {
          sdk.console.error(
            `Failed to parse GraphQL request ${requestId}: ${String(error)}`
          );
          continue;
        }

        if (operationsForRequest.length === 0) {
          continue;
        }

        const responseData = parseResponseJson(item.response);
        const responseTypes = responseData
          ? collectResponseFieldTypes(responseData)
          : undefined;

        for (const operation of operationsForRequest) {
          const signature = signatureForOperation(operation);
          const existing = operations.get(signature);
          if (!existing) {
            const state = createOperationState(operation, requestId);
            if (responseTypes) {
              mergeFieldTypes(state.fieldTypes, responseTypes);
            }
            operations.set(signature, state);
            currentStatus.counts.deduped = operations.size;
          } else {
            updateOperationState(existing, requestId, responseTypes);
          }
        }
      }

      const lastItem = connection.items[connection.items.length - 1];
      cursor = lastItem?.cursor;
      if (!cursor) {
        break;
      }
    }

    const updatedAt = new Date().toISOString();
    currentModel = {
      operations: Array.from(operations.values())
        .map(buildOperationSummary)
        .sort((left, right) => left.name.localeCompare(right.name)),
      requests: Array.from(requestSummaries.values()).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      ),
      counts: currentStatus.counts,
      updatedAt,
    };

    currentStatus = {
      state: "done",
      counts: currentStatus.counts,
      startedAt,
      finishedAt: updatedAt,
    };

    return ok(currentStatus);
  } catch (error) {
    currentStatus = {
      state: "error",
      counts: currentStatus.counts,
      startedAt,
      finishedAt: new Date().toISOString(),
      message: String(error),
    };
    return err(`Extraction failed: ${String(error)}`);
  }
};

const getExtractionStatus = () => ok(currentStatus);

const getModel = () => {
  if (!currentModel) {
    return err("No extraction data available");
  }
  return ok(currentModel);
};

const getRequestDetails = async (
  sdk: SDK,
  requestId: string
): Promise<Result<RequestDetails>> => {
  const entry = await sdk.requests.get(requestId);
  if (!entry) {
    return err("Request not found");
  }
  const requestText = entry.request.getRaw().toText();
  const responseText = entry.response?.getRaw().toText();
  return ok({
    id: requestId,
    method: entry.request.getMethod(),
    url: entry.request.getUrl(),
    createdAt: entry.request.getCreatedAt().toISOString(),
    requestText,
    responseText,
  });
};

export type API = DefineAPI<{
  extractInScopeRequests: typeof extractInScopeRequests;
  getExtractionStatus: typeof getExtractionStatus;
  getModel: typeof getModel;
  getRequestDetails: typeof getRequestDetails;
}>;

export type {
  ExtractionCounts,
  ExtractionOptions,
  ExtractionStatus,
  GraphQLKind,
  GraphQLModel,
  OperationField,
  OperationSummary,
  OperationVariable,
  RequestDetails,
  RequestSummary,
  Result,
};

export function init(sdk: SDK<API>) {
  sdk.api.register("extractInScopeRequests", extractInScopeRequests);
  sdk.api.register("getExtractionStatus", getExtractionStatus);
  sdk.api.register("getModel", getModel);
  sdk.api.register("getRequestDetails", getRequestDetails);
}
