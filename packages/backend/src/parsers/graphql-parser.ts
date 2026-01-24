import type { Request, Response } from "caido:utils";
import { parse } from "graphql";
import type { GraphQLKind, OperationVariable } from "@graphql-mapper/shared";
import { extractRawBody, previewText } from "../utils/helpers";

type GraphQLParseResult = {
  payload: { query: string; operationName?: string; variables?: Record<string, unknown> } | null;
  debug?: {
    reason: string;
    method: string;
    url: string;
    contentType: string;
    bodyPreview?: string;
    rawBodyPreview?: string;
    queryPreview?: string;
    shouldLog: boolean;
  };
};

const isGraphQLJsonPayload = (payload: unknown): payload is {
  query?: string;
  operationName?: string;
  variables?: Record<string, unknown>;
} => {
  return typeof payload === "object" && payload !== null;
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

export const parseGraphQLRequest = (request: Request): GraphQLParseResult => {
  const contentType = request.getHeader("content-type")?.join(";") ?? "";
  const bodyText = request.getBody()?.toText();
  const queryString = request.getQuery();
  if (contentType.includes("application/graphql") && bodyText) {
    return { payload: { query: bodyText } };
  }
  const tryParsePayload = (payload: string) => {
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (isGraphQLJsonPayload(parsed) && typeof parsed.query === "string") {
        return {
          query: parsed.query,
          operationName: parsed.operationName,
          variables: parsed.variables,
        };
      }
    } catch {
      const formPayload = new URLSearchParams(payload);
      const queryParam = formPayload.get("query");
      if (queryParam) {
        return {
          query: queryParam,
          operationName: formPayload.get("operationName") ?? undefined,
        };
      }
      const queryMatch = payload.match(/"query"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (queryMatch) {
        const queryValue = JSON.parse(`"${queryMatch[1]}"`) as string;
        const operationMatch = payload.match(
          /"operationName"\s*:\s*"((?:[^"\\]|\\.)*)"/s
        );
        return {
          query: queryValue,
          operationName: operationMatch
            ? (JSON.parse(`"${operationMatch[1]}"`) as string)
            : undefined,
        };
      }
    }
    return null;
  };
  if (bodyText) {
    const parsed = tryParsePayload(bodyText);
    if (parsed) {
      return { payload: parsed };
    }
  }
  const rawText = request.getRaw().toText();
  const rawBody = extractRawBody(rawText).trim();
  if (rawBody) {
    const parsed = tryParsePayload(rawBody);
    if (parsed) {
      return { payload: parsed };
    }
  }
  if (queryString) {
    const queryParam = new URLSearchParams(queryString).get("query");
    if (queryParam) {
      return { payload: { query: queryParam } };
    }
  }
  const bodyPreview = previewText(bodyText);
  const rawBodyPreview = previewText(rawBody);
  const queryPreview = previewText(queryString);
  const shouldLog =
    contentType.includes("graphql") ||
    contentType.includes("json") ||
    Boolean(bodyText?.includes("query")) ||
    Boolean(rawBody?.includes("query")) ||
    Boolean(queryString?.includes("query"));
  let reason = "No GraphQL payload found";
  if (contentType.includes("application/graphql") && !bodyText) {
    reason = "application/graphql but empty body";
  } else if (!bodyText && !rawBody && !queryString) {
    reason = "no request body or query string";
  } else if (bodyText || rawBody) {
    reason = "body present but no query field detected";
  }
  return {
    payload: null,
    debug: {
      reason,
      method: request.getMethod(),
      url: request.getUrl(),
      contentType,
      bodyPreview,
      rawBodyPreview,
      queryPreview,
      shouldLog,
    },
  };
};

export const parseResponseJson = (response?: Response) => {
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

export const parseOperations = (
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
    const operationDefinition = definition as import("graphql").OperationDefinitionNode;
    const kind = operationDefinition.operation;
    const name = resolveOperationName(kind, operationDefinition.name?.value, operationIndex);
    operationIndex += 1;
    const variables =
      operationDefinition.variableDefinitions?.map((variable) => ({
        name: variable.variable.name.value,
        type: printTypeNode(variable.type),
      })) ?? [];
    const fieldPaths = normalizePaths(
      collectFieldPaths(operationDefinition.selectionSet ?? { kind: "SelectionSet", selections: [] })
    );
    operations.push({ kind, name, variables, fieldPaths });
  }
  return operations;
};
