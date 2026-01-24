import { ref, computed } from "vue";
import type { GraphQLModel, OperationSummary, RequestSummary } from "@graphql-mapper/shared";

export const useOperationSelection = (model: { value: GraphQLModel | null }) => {
  const selectedOperationId = ref<string | null>(null);
  const selectedRequestId = ref<string | null>(null);

  const selectedOperation = computed(() => {
    if (!selectedOperationId.value || !model.value) {
      return null;
    }
    return model.value.operations.find(
      (operation: OperationSummary) => operation.id === selectedOperationId.value
    );
  });

  const requestLookup = computed(() => {
    const lookup = new Map<string, RequestSummary>();
    for (const request of model.value?.requests ?? []) {
      lookup.set(request.id, request);
    }
    return lookup;
  });

  const selectedRequests = computed(() => {
    if (!selectedOperation.value) {
      return [];
    }
    return selectedOperation.value.requestIds
      .map((id: string) => requestLookup.value.get(id))
      .filter((entry: RequestSummary | undefined): entry is RequestSummary => Boolean(entry));
  });

  const selectOperation = (operation: OperationSummary) => {
    selectedOperationId.value = operation.id;
    const firstRequestId = operation.requestIds[0] ?? null;
    selectedRequestId.value = firstRequestId;
  };

  const selectRequest = (requestId: string) => {
    selectedRequestId.value = requestId;
  };

  return {
    selectedOperationId,
    selectedRequestId,
    selectedOperation,
    selectedRequests,
    selectOperation,
    selectRequest,
  };
};
