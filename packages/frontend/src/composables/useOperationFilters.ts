import type { GraphQLModel, OperationSummary } from "@graphql-mapper/shared";
import { computed, ref } from "vue";

export const useOperationFilters = (model: { value: GraphQLModel | null }) => {
  const filterText = ref("");
  const filterKind = ref<"all" | "query" | "mutation" | "subscription">("all");

  const filteredOperations = computed(() => {
    const operations = model.value?.operations ?? [];
    return operations.filter((operation: OperationSummary) => {
      const matchesKind =
        filterKind.value === "all" || operation.kind.toLowerCase() === filterKind.value;

      const matchesText =
        filterText.value.trim().length === 0 ||
        operation.name.toLowerCase().includes(filterText.value.toLowerCase());
      return matchesKind && matchesText;
    });
  });

  return {
    filterText,
    filterKind,
    filteredOperations,
  };
};
