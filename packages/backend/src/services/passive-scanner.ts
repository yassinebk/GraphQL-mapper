import type { SDK } from "caido:plugin";
import type { Request, Response } from "caido:utils";
import type { RequestSummary, Result } from "@graphql-mapper/shared";
import { ok } from "../utils/helpers";
import { parseGraphQLRequest, parseOperations, parseResponseJson } from "../parsers/graphql-parser";
import { collectResponseFieldTypes } from "../utils/type-inference";
import {
  createOperationState,
  emptyCounts,
  operationStateFromSummary,
  signatureForOperation,
  updateOperationState,
  type OperationState,
} from "../services/state-manager";

export class PassiveScanner {
  private enabled = false;
  private sdkInstance: SDK | null = null;

  setSDK(sdk: SDK) {
    this.sdkInstance = sdk;
  }

  setEnabled(enabled: boolean): Result<{ enabled: boolean }> {
    this.enabled = enabled;
    if (this.sdkInstance) {
      this.sdkInstance.console.log(`[GraphQL mapper] Passive scan ${enabled ? 'enabled' : 'disabled'}`);
    }
    return ok({ enabled: this.enabled });
  }

  getStatus(): Result<{ enabled: boolean }> {
    return ok({ enabled: this.enabled });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async processRequest(
    sdk: SDK,
    request: Request,
    response: Response | undefined,
    currentModel: any,
    emitDataChange: () => void
  ): Promise<any> {
    if (!this.enabled) {
      return currentModel;
    }

    try {
      const inScope = sdk.requests.inScope(request);
      if (!inScope) {
        return currentModel;
      }

      const parsedRequest = parseGraphQLRequest(request);
      if (!parsedRequest.payload) {
        return currentModel;
      }

      const requestId = request.getId();

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

      if (requestSummaries.has(requestId)) {
        return currentModel;
      }

      requestSummaries.set(requestId, {
        id: requestId,
        method: request.getMethod(),
        url: request.getUrl(),
        host: request.getHost(),
        path: request.getPath(),
        createdAt: request.getCreatedAt().toISOString(),
      });

      let operationsForRequest;

      try {
        operationsForRequest = parseOperations(parsedRequest.payload.query);
      } catch (error) {
        sdk.console.error(
          `[GraphQL mapper] Failed to parse GraphQL request ${requestId}: ${String(error)}`
        );
        return currentModel;
      }

      if (operationsForRequest.length === 0) {
        return currentModel;
      }

      const responseData = parseResponseJson(response);
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
        } else {
          updateOperationState(existing, requestId, responseTypes);
        }
      }

      const updatedAt = new Date().toISOString();
      const newCounts = currentModel?.counts ?? emptyCounts();
      newCounts.graphql += 1;
      newCounts.deduped = operations.size;

      const updatedModel = {
        operations: Array.from(operations.values())
          .map((state) => ({
            id: state.id,
            name: state.name,
            kind: state.kind,
            signature: state.signature,
            variables: state.variables,
            fields: state.fieldPaths.map((path) => ({
              path,
              inferredType: Array.from(state.fieldTypes.get(path) ?? []).sort().join(" | ") || undefined,
            })),
            requestIds: Array.from(state.requestIds),
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        requests: Array.from(requestSummaries.values()).sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt)
        ),
        counts: newCounts,
        updatedAt,
      };

      emitDataChange();

      sdk.console.debug(
        `[GraphQL mapper] Passive scan processed GraphQL request: ${request.getMethod()} ${request.getUrl()}`
      );

      return updatedModel;
    } catch (error) {
      sdk.console.error(
        `[GraphQL mapper] Passive scan error: ${String(error)}`
      );
      return currentModel;
    }
  }
}
