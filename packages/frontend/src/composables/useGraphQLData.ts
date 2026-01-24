import type { FrontendSDK } from "@/types";
import type {
  ExtractionStatus,
  GraphQLModel,
  RequestDetails,
  Result
} from "@graphql-mapper/shared";
import { computed, ref } from "vue";

export const useGraphQLData = (sdk: FrontendSDK) => {
  const status = ref<ExtractionStatus | null>(null);
  const model = ref<GraphQLModel | null>(null);
  const requestDetails = ref<RequestDetails | null>(null);
  const passiveScanEnabled = ref(false);

  const isExtracting = computed(() => status.value?.state === "running");
  const hasModel = computed(() => (model.value?.operations.length ?? 0) > 0);

  const showToastError = (message: string) => {
    sdk.window.showToast(message, { variant: "error" });
  };

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    sdk.window.showToast(message, { variant });
  };

  const unwrapResult = <T,>(result: Result<T>): T | null => {
    if (result.kind === "Error") {
      showToastError(result.error);
      return null;
    }
    return result.value;
  };

  const loadStatus = async () => {
    const result = await sdk.backend.getExtractionStatus();
    const resolved = unwrapResult(result);
    if (resolved) {
      status.value = resolved;
    }
  };

  const loadModel = async () => {
    const result = await sdk.backend.getModel();
    const resolved = unwrapResult(result);
    if (!resolved) {
      return;
    }
    model.value = resolved;
  };

  const refreshExtraction = async () => {
    status.value = {
      state: "running",
      counts: status.value?.counts ?? {
        scanned: 0,
        inScope: 0,
        graphql: 0,
        deduped: 0,
      },
    };
    const result = await sdk.backend.extractInScopeRequests({
      pageSize: 500,
      maxRequests: 5000,
    });
    const resolved = unwrapResult(result);
    if (resolved) {
      status.value = resolved;
    }
    await loadModel();
  };

  const loadRequestDetails = async (requestId: string) => {
    const result = await sdk.backend.getRequestDetails(requestId);
    const resolved = unwrapResult(result);
    if (!resolved) {
      return;
    }
    requestDetails.value = resolved;
  };

  const refreshData = async () => {
    await loadStatus();
    await loadModel();
  };

  const loadPassiveScanStatus = async () => {
    const result = await sdk.backend.getPassiveScanStatus();
    const resolved = unwrapResult(result);
    if (resolved) {
      passiveScanEnabled.value = resolved.enabled;
    }
  };

  const togglePassiveScan = async (newValue: boolean) => {
    const result = await sdk.backend.setPassiveScan(newValue);
    const resolved = unwrapResult(result);
    if (resolved) {
      showToast(
        `Passive scan ${resolved.enabled ? 'enabled' : 'disabled'}`,
        "success"
      );
      return true;
    } else {
      return false;
    }
  };

  return {
    status,
    model,
    requestDetails,
    passiveScanEnabled,
    isExtracting,
    hasModel,
    showToast,
    showToastError,
    loadStatus,
    loadModel,
    refreshExtraction,
    loadRequestDetails,
    refreshData,
    loadPassiveScanStatus,
    togglePassiveScan,
  };
};
