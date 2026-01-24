import type { SDK } from "caido:plugin";
import type { Cursor } from "caido:utils";
import type {
  ExtractionOptions,
  ExtractionStatus,
  RequestSummary,
  Result,
} from "@graphql-mapper/shared";
import { err, ok } from "../utils/helpers";
import { parseGraphQLRequest, parseOperations, parseResponseJson } from "../parsers/graphql-parser";
import { collectResponseFieldTypes } from "../utils/type-inference";
import {
  buildModel,
  createOperationState,
  emptyCounts,
  operationStateFromSummary,
  signatureForOperation,
  updateOperationState,
  type OperationState,
} from "../services/state-manager";

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_REQUESTS = 5000;

export const extractInScopeRequests = async (
  sdk: SDK,
  currentModel: any,
  options?: ExtractionOptions
): Promise<Result<{ status: ExtractionStatus; model: any }>> => {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const startedAt = new Date().toISOString();

  const currentStatus: ExtractionStatus = {
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
        sdk.console.debug(`Scanned request ${item.request.getId()}: inScope=${inScope}`);
        if (!inScope) {
          continue;
        }
        currentStatus.counts.inScope += 1;

        const parsedRequest = parseGraphQLRequest(item.request);
        if (!parsedRequest.payload) {
          if (parsedRequest.debug?.shouldLog) {
            sdk.console.log(
              [
                "[GraphQL mapper] Skipped request:",
                `${parsedRequest.debug.method} ${parsedRequest.debug.url}`,
                `reason=${parsedRequest.debug.reason}`,
                `contentType=${parsedRequest.debug.contentType || "(none)"}`,
                `bodyPreview=${parsedRequest.debug.bodyPreview || "(none)"}`,
                `rawBodyPreview=${parsedRequest.debug.rawBodyPreview || "(none)"}`,
                `queryPreview=${parsedRequest.debug.queryPreview || "(none)"}`,
              ].join(" ")
            );
          }
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

        let operationsForRequest;

        try {
          operationsForRequest = parseOperations(parsedRequest.payload.query);
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
              updateOperationState(state, requestId, responseTypes);
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

    const model = buildModel(operations, requestSummaries, currentStatus.counts);

    return ok({
      status: {
        state: "done",
        counts: currentStatus.counts,
        startedAt,
        finishedAt: model.updatedAt,
      },
      model,
    });
  } catch (error) {
    return err(`Extraction failed: ${String(error)}`);
  }
};

export const extractRequestsById = async (
  sdk: SDK,
  currentModel: any,
  options: { requestIds: string[] }
): Promise<Result<{ status: ExtractionStatus; model: any }>> => {
  if (!options.requestIds || options.requestIds.length === 0) {
    return err("No requests selected");
  }

  const startedAt = new Date().toISOString();
  const baseCounts = currentModel?.counts ?? emptyCounts();
  const currentStatus: ExtractionStatus = {
    state: "running",
    counts: { ...baseCounts },
    startedAt,
  };

  try {
    const operations = new Map<string, OperationState>();
    const requestSummaries = new Map<string, RequestSummary>();

    if (currentModel) {
      for (const summary of currentModel.operations) {
        operations.set(summary.signature, operationStateFromSummary(summary));
      }
      for (const summary of currentModel.requests) {
        requestSummaries.set(summary.id, summary);
      }
    }

    for (const requestId of options.requestIds) {
      currentStatus.counts.scanned += 1;
      const entry = await sdk.requests.get(requestId);
      if (!entry) {
        continue;
      }
      const isNewRequest = !requestSummaries.has(requestId);
      if (isNewRequest) {
        currentStatus.counts.inScope += 1;
      }

      const parsedRequest = parseGraphQLRequest(entry.request);
      if (!parsedRequest.payload) {
        if (parsedRequest.debug?.shouldLog) {
          sdk.console.log(
            [
              "[GraphQL mapper] Skipped request:",
              `${parsedRequest.debug.method} ${parsedRequest.debug.url}`,
              `reason=${parsedRequest.debug.reason}`,
              `contentType=${parsedRequest.debug.contentType || "(none)"}`,
              `bodyPreview=${parsedRequest.debug.bodyPreview || "(none)"}`,
              `rawBodyPreview=${parsedRequest.debug.rawBodyPreview || "(none)"}`,
              `queryPreview=${parsedRequest.debug.queryPreview || "(none)"}`,
            ].join(" ")
          );
        }
        continue;
      }

      if (isNewRequest) {
        currentStatus.counts.graphql += 1;
      }
      if (isNewRequest) {
        requestSummaries.set(requestId, {
          id: requestId,
          method: entry.request.getMethod(),
          url: entry.request.getUrl(),
          host: entry.request.getHost(),
          path: entry.request.getPath(),
          createdAt: entry.request.getCreatedAt().toISOString(),
        });
      }

      let operationsForRequest;

      try {
        operationsForRequest = parseOperations(parsedRequest.payload.query);
      } catch (error) {
        sdk.console.error(
          `Failed to parse GraphQL request ${requestId}: ${String(error)}`
        );
        continue;
      }

      if (operationsForRequest.length === 0) {
        continue;
      }

      const responseData = parseResponseJson(entry.response);
      const responseTypes = responseData
        ? collectResponseFieldTypes(responseData)
        : undefined;

      for (const operation of operationsForRequest) {
        const signature = signatureForOperation(operation);
        const existing = operations.get(signature);
        if (!existing) {
          const state = createOperationState(operation, requestId);
          if (responseTypes) {
            updateOperationState(state, requestId, responseTypes);
          }
          operations.set(signature, state);
          currentStatus.counts.deduped = operations.size;
        } else {
          updateOperationState(existing, requestId, responseTypes);
        }
      }
    }

    const updatedAt = new Date().toISOString();
    currentStatus.counts.deduped = operations.size;
    const model = buildModel(operations, requestSummaries, currentStatus.counts);

    return ok({
      status: {
        state: "done",
        counts: currentStatus.counts,
        startedAt,
        finishedAt: updatedAt,
      },
      model,
    });
  } catch (error) {
    return err(`Extraction failed: ${String(error)}`);
  }
};
