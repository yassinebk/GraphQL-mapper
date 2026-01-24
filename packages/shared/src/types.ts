export type Result<T> =
  | { kind: "Ok"; value: T }
  | { kind: "Error"; error: string };

export type GraphQLKind = "query" | "mutation" | "subscription";

export type ExtractionOptions = {
  pageSize?: number;
  maxRequests?: number;
};

export type ExtractionCounts = {
  scanned: number;
  inScope: number;
  graphql: number;
  deduped: number;
};

export type ExtractionStatus = {
  state: "idle" | "running" | "done" | "error";
  counts: ExtractionCounts;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type OperationVariable = {
  name: string;
  type: string;
};

export type OperationField = {
  path: string;
  inferredType?: string;
};

export type OperationSummary = {
  id: string;
  name: string;
  kind: GraphQLKind;
  signature: string;
  variables: OperationVariable[];
  fields: OperationField[];
  requestIds: string[];
};

export type RequestSummary = {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  createdAt: string;
};

export type GraphQLModel = {
  operations: OperationSummary[];
  requests: RequestSummary[];
  counts: ExtractionCounts;
  updatedAt: string;
};

export type RequestDetails = {
  id: string;
  method: string;
  url: string;
  createdAt: string;
  requestText: string;
  responseText?: string;
};
