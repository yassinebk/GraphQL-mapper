import type {
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
} from "@graphql-mapper/shared";
import type { DefineAPI, SDK } from "caido:plugin";

import {
  extractInScopeRequests,
  extractRequestsById,
} from "./extractors/request-extractor";
import { PassiveScanner } from "./services/passive-scanner";
import { emptyCounts } from "./services/state-manager";
import { err, ok } from "./utils/helpers";

let currentStatus: ExtractionStatus = {
  state: "idle",
  counts: emptyCounts(),
};

let currentModel: GraphQLModel | undefined = undefined;

let sdkInstance: SDK | undefined = undefined;

const passiveScanner = new PassiveScanner();

const getExtractionStatus = () => ok(currentStatus);

const getModel = () => {
  if (!currentModel) {
    return ok({
      operations: [],
      requests: [],
      counts: emptyCounts(),
      updatedAt: new Date().toISOString(),
    });
  }
  return ok(currentModel);
};

const getRequestDetails = async (
  sdk: SDK,
  requestId: string,
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

const extractInScopeRequestsHandler = async (
  sdk: SDK,
  options?: ExtractionOptions,
): Promise<Result<ExtractionStatus>> => {
  if (currentStatus.state === "running") {
    return err("Extraction already in progress");
  }

  currentStatus = {
    state: "running",
    counts: emptyCounts(),
    startedAt: new Date().toISOString(),
  };

  const result = await extractInScopeRequests(sdk, currentModel, options);

  if (result.kind === "Ok") {
    currentStatus = result.value.status;
    currentModel = result.value.model;
    // Emit event
    if (sdkInstance !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sdkInstance.api as any).send("graphql-mapper.data-changed", {});
    }
    return ok(currentStatus);
  } else {
    currentStatus = {
      state: "error",
      counts: currentStatus.counts,
      startedAt: currentStatus.startedAt,
      finishedAt: new Date().toISOString(),
      message: result.error,
    };
    return err(result.error);
  }
};

const extractRequestsByIdHandler = async (
  sdk: SDK,
  options: { requestIds: string[] },
): Promise<Result<ExtractionStatus>> => {
  if (currentStatus.state === "running") {
    return err("Extraction already in progress");
  }

  currentStatus = {
    state: "running",
    counts: currentModel?.counts ?? emptyCounts(),
    startedAt: new Date().toISOString(),
  };

  const result = await extractRequestsById(sdk, currentModel, options);

  if (result.kind === "Ok") {
    currentStatus = result.value.status;
    currentModel = result.value.model;
    // Emit event
    if (sdkInstance !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sdkInstance.api as any).send("graphql-mapper.data-changed", {});
    }
    return ok(currentStatus);
  } else {
    currentStatus = {
      state: "error",
      counts: currentStatus.counts,
      startedAt: currentStatus.startedAt,
      finishedAt: new Date().toISOString(),
      message: result.error,
    };
    return err(result.error);
  }
};

export type API = DefineAPI<{
  extractInScopeRequests: typeof extractInScopeRequestsHandler;
  extractRequestsById: typeof extractRequestsByIdHandler;
  getExtractionStatus: typeof getExtractionStatus;
  getModel: typeof getModel;
  getRequestDetails: typeof getRequestDetails;
  setPassiveScan: (sdk: SDK, enabled: boolean) => Result<{ enabled: boolean }>;
  getPassiveScanStatus: (sdk: SDK) => Result<{ enabled: boolean }>;
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
  sdkInstance = sdk;
  passiveScanner.setSDK(sdk);

  sdk.api.register("extractInScopeRequests", extractInScopeRequestsHandler);
  sdk.api.register("extractRequestsById", extractRequestsByIdHandler);
  sdk.api.register("getExtractionStatus", getExtractionStatus);
  sdk.api.register("getModel", getModel);
  sdk.api.register("getRequestDetails", getRequestDetails);
  sdk.api.register("setPassiveScan", (sdk, enabled: boolean) =>
    passiveScanner.setEnabled(enabled),
  );
  sdk.api.register("getPassiveScanStatus", (sdk) => passiveScanner.getStatus());

  // Register response interceptor for passive scanning
  sdk.events.onInterceptResponse(async (eventSdk, request, response) => {
    currentModel = await passiveScanner.processRequest(
      eventSdk,
      request,
      response,
      currentModel,
      () => {
        if (sdkInstance !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sdkInstance.api as any).send("graphql-mapper.data-changed", {});
        }
      },
    );
  });

  sdk.console.log("[GraphQL mapper] Plugin initialized");
}
