declare module 'graphql-mapper-backend' {
  export type Result<T> =
    | { kind: "Ok"; value: T }
    | { kind: "Error"; error: string };

  export type GraphQLKind = "query" | "mutation" | "subscription";

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

  export type PassiveScanStatus = {
    enabled: boolean;
  };

  export type API = {
    extractInScopeRequests: (options?: {
      pageSize?: number;
      maxRequests?: number;
    }) => Promise<Result<ExtractionStatus>>;
    extractRequestsById: (options: {
      requestIds: string[];
    }) => Promise<Result<ExtractionStatus>>;
    getExtractionStatus: () => Promise<Result<ExtractionStatus>>;
    getModel: () => Promise<Result<GraphQLModel>>;
    getRequestDetails: (requestId: string) => Promise<Result<RequestDetails>>;
    setPassiveScan: (enabled: boolean) => Promise<Result<PassiveScanStatus>>;
    getPassiveScanStatus: () => Promise<Result<PassiveScanStatus>>;
    onEvent: (event: "graphql-mapper.data-changed", callback: () => void) => void;
  };
}
