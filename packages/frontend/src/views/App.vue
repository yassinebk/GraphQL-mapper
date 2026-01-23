<script setup lang="ts">
import Button from "primevue/button";
import ProgressBar from "primevue/progressbar";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanel from "primevue/tabpanel";
import TabPanels from "primevue/tabpanels";
import Tabs from "primevue/tabs";
import Tag from "primevue/tag";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import InputSwitch from "primevue/inputswitch";
import { computed, onMounted, ref, watch } from "vue";

import EmptyState from "@/components/EmptyState.vue";
import ExportMenu from "@/components/ExportMenu.vue";
import FieldList from "@/components/FieldList.vue";
import LoadingSkeleton from "@/components/LoadingSkeleton.vue";
import OperationCard from "@/components/OperationCard.vue";
import OperationSearch from "@/components/OperationSearch.vue";
import RequestCard from "@/components/RequestCard.vue";
import VariableList from "@/components/VariableList.vue";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useSDK } from "@/plugins/sdk";
import type {
  ExtractionStatus,
  GraphQLModel,
  OperationSummary,
  RequestDetails,
  RequestSummary,
  Result,
} from "@/types";

const sdk = useSDK();

const status = ref<ExtractionStatus | null>(null);
const model = ref<GraphQLModel | null>(null);
const selectedOperationId = ref<string | null>(null);
const selectedRequestId = ref<string | null>(null);
const requestDetails = ref<RequestDetails | null>(null);
const filterText = ref("");
const filterKind = ref<"all" | "query" | "mutation" | "subscription">("all");
const activeTab = ref("overview");
const passiveScanEnabled = ref(false);

const requestEditorContainer = ref<HTMLDivElement | null>(null);
const responseEditorContainer = ref<HTMLDivElement | null>(null);
const requestEditor = ref<ReturnType<typeof sdk.ui.httpRequestEditor> | null>(
  null
);
const responseEditor = ref<ReturnType<typeof sdk.ui.httpResponseEditor> | null>(
  null
);

const isExtracting = computed(() => status.value?.state === "running");
const hasModel = computed(() => (model.value?.operations.length ?? 0) > 0);

const filteredOperations = computed(() => {
  const operations = model.value?.operations ?? [];
  const filteredOperations =operations.filter((operation: OperationSummary) => {
    const matchesKind =
      filterKind.value === "all" || operation.kind.toLowerCase() === filterKind.value;

    const matchesText =
      filterText.value.trim().length === 0 ||
      operation.name.toLowerCase().includes(filterText.value.toLowerCase());
    return matchesKind && matchesText;
  });

  return filteredOperations;
});

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

const setEditorText = (
  editor: ReturnType<typeof sdk.ui.httpRequestEditor> | null,
  text: string
) => {
  if (!editor) {
    return;
  }
  const view = editor.getEditorView?.();
  if (!view) {
    return;
  }
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: text,
    },
  });
};

const setResponseText = (
  editor: ReturnType<typeof sdk.ui.httpResponseEditor> | null,
  text: string
) => {
  if (!editor) {
    return;
  }
  const view = editor.getEditorView?.();
  if (!view) {
    return;
  }
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: text,
    },
  });
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

const selectOperation = (operation: OperationSummary) => {
  selectedOperationId.value = operation.id;
  const firstRequestId = operation.requestIds[0] ?? null;
  selectedRequestId.value = firstRequestId;
};

const selectRequest = (requestId: string) => {
  selectedRequestId.value = requestId;
};

const openRequestDetails = (requestId: string) => {
  selectedRequestId.value = requestId;
  activeTab.value = "raw";
};

const navigateOperations = (direction: "next" | "prev") => {
  const operations = filteredOperations.value;
  if (operations.length === 0) return;
  
  const currentIndex = operations.findIndex(
    (op: OperationSummary) => op.id === selectedOperationId.value
  );
  
  if (currentIndex === -1) {
    selectedOperationId.value = operations[0]?.id ?? null;
    return;
  }
  
  if (direction === "next") {
    const nextIndex = (currentIndex + 1) % operations.length;
    selectOperation(operations[nextIndex]!);
  } else {
    const prevIndex = currentIndex === 0 ? operations.length - 1 : currentIndex - 1;
    selectOperation(operations[prevIndex]!);
  }
};

const focusSearch = () => {
  const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
  searchInput?.focus();
};

useKeyboardShortcuts([
  {
    key: "k",
    meta: true,
    handler: focusSearch,
    description: "Focus search",
  },
  {
    key: "ArrowDown",
    handler: () => navigateOperations("next"),
    description: "Next operation",
  },
  {
    key: "ArrowUp",
    handler: () => navigateOperations("prev"),
    description: "Previous operation",
  },
]);

watch(selectedOperation, (operation) => {
  if (!operation) {
    selectedRequestId.value = null;
    requestDetails.value = null;
    return;
  }
  selectedRequestId.value = operation.requestIds[0] ?? null;
});



watch(selectedRequestId, async (requestId) => {
  if (!requestId) {
    requestDetails.value = null;
    return;
  }
  await loadRequestDetails(requestId);
});

watch(requestDetails, (details) => {
  if (!details) {
    return;
  }
  setEditorText(requestEditor.value, details.requestText);
  setResponseText(
    responseEditor.value,
    details.responseText ?? "No response captured for this request."
  );
});

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

const togglePassiveScan = async () => {
  const newValue = passiveScanEnabled.value;
  const result = await sdk.backend.setPassiveScan(newValue);
  const resolved = unwrapResult(result);
  if (resolved) {
    showToast(
      `Passive scan ${resolved.enabled ? 'enabled' : 'disabled'}`,
      "success"
    );
  } else {
    // Revert on error
    passiveScanEnabled.value = !newValue;
  }
};

watch(passiveScanEnabled, async (newValue, oldValue) => {
  // Skip initial load
  if (oldValue !== undefined && newValue !== oldValue) {
    await togglePassiveScan();
  }
});

onMounted(async () => {
  const request = sdk.ui.httpRequestEditor();
  const response = sdk.ui.httpResponseEditor();
  requestEditor.value = request;
  responseEditor.value = response;

  if (requestEditorContainer.value) {
    requestEditorContainer.value.appendChild(request.getElement());
  }
  if (responseEditorContainer.value) {
    responseEditorContainer.value.appendChild(response.getElement());
  }

  await refreshData();
  await loadPassiveScanStatus();

  // Listen for backend data-changed events
  sdk.backend.onEvent("graphql-mapper.data-changed", async () => {
    await refreshData();
  });

  // Poll for updates every 2 seconds when status is running
  const pollInterval = setInterval(async () => {
    const currentStatus = status.value?.state;
    if (currentStatus === "running") {
      await refreshData();
    }
  }, 2000);
  
  // Cleanup on unmount
  return () => {
    clearInterval(pollInterval);
  };
});
</script>

<template>
  <div class="h-full w-full bg-surface-900 flex flex-col overflow-hidden">
    <!-- Top Header -->
    <header class="h-14 border-b border-surface-700 bg-surface-800/80 backdrop-blur flex items-center justify-between px-4 shrink-0 z-10">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold text-surface-0">GraphQL Mapper</h1>
        <div v-if="status?.startedAt" class="text-xs text-surface-400 bg-surface-700/50 px-2 py-1 rounded">
            Last: {{ status.startedAt }}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-surface-700/50 px-3 py-1.5 rounded">
          <label for="passive-scan-toggle" class="text-xs text-surface-300 cursor-pointer">
            Passive Scan
          </label>
          <InputSwitch
            id="passive-scan-toggle"
            v-model="passiveScanEnabled"
          />
        </div>
        <Tag
            v-if="status?.state"
            :value="status.state"
            :severity="status.state === 'error' ? 'danger' : 'secondary'"
            class="uppercase !text-[10px]"
        />
        <Button
          :loading="isExtracting"
          label="Extract History"
          icon="fas fa-bolt"
          size="small"
          severity="primary"
          @click="refreshExtraction"
        />
      </div>
    </header>

    <div v-if="isExtracting" class="h-1 w-full bg-surface-800">
      <ProgressBar mode="indeterminate" class="!h-1" />
    </div>

    <!-- Main Content Splitter -->
    <main class="flex-1 min-h-0 overflow-hidden relative">
      <Splitter class="h-full border-none bg-transparent !overflow-hidden" stateKey="main-layout" stateStorage="local">
        
        <!-- Sidebar: Operations List -->
        <SplitterPanel :size="25" :minSize="20" class="flex flex-col bg-surface-800/30 border-r border-surface-700 overflow-hidden">
            <div class="p-3 border-b border-surface-700 bg-surface-800/50 shrink-0">
              <OperationSearch
                v-model="filterText"
                :filter-kind="filterKind"
                :total-count="model?.operations.length ?? 0"
                :filtered-count="filteredOperations.length"
                @update:filter-kind="filterKind = $event"
              />
            </div>
            
            <div class="flex-1 overflow-y-auto p-2 min-h-0">
                <div v-if="isExtracting" class="space-y-2">
                    <LoadingSkeleton type="card" :count="5" />
                </div>
                
                <div v-else-if="!hasModel" class="h-full flex flex-col items-center justify-center p-4">
                  <EmptyState
                    title="No operations"
                    description="Run extraction to start"
                    icon="fas fa-inbox"
                    action-label="Extract"
                    @action="refreshExtraction"
                  />
                </div>
                
                <div v-else-if="filteredOperations.length === 0" class="h-full flex flex-col items-center justify-center p-4">
                     <EmptyState
                      title="No matches"
                      description="Adjust filters"
                      icon="fas fa-search"
                    />
                </div>
                
                <div v-else class="space-y-2 pb-4">
                  <OperationCard
                    v-for="operation in filteredOperations"
                    :key="operation.id"
                    :operation="operation"
                    :is-active="operation.id === selectedOperationId"
                    @select="selectOperation"
                  />
                </div>
            </div>
        </SplitterPanel>

        <!-- Main Panel: Details -->
        <SplitterPanel :size="75" :minSize="40" class="flex flex-col bg-surface-900 relative overflow-hidden">
            <div v-if="selectedOperation" class="absolute inset-0 flex flex-col">
                <Tabs v-model:value="activeTab" class="flex flex-col h-full">
                    <!-- Operation Header -->
                    <div class="bg-surface-800 border-b border-surface-700 px-6 pt-6 pb-0 shadow-sm shrink-0">
                        <div class="flex items-start justify-between mb-6">
                            <div class="flex-1 min-w-0 mr-4">
                                <h2 class="text-xl font-bold text-surface-50 break-all mb-1">{{ selectedOperation.name }}</h2>
                            </div>
                            <div class="flex items-start gap-2 shrink-0">
                                <ExportMenu
                                    :operation="selectedOperation"
                                    @toast="showToast"
                                />
                            </div>
                        </div>
                        
                        <!-- PrimeVue Tabs -->
                        <TabList class="!border-b-0 !p-0 gap-4">
                            <Tab value="overview" class="!px-4 !py-3 !font-medium">Overview</Tab>
                            <Tab value="requests" class="!px-4 !py-3 !font-medium">
                                Requests <span class="bg-surface-700 text-surface-300 text-xs rounded px-1.5 ml-2">{{ selectedRequests.length }}</span>
                            </Tab>
                            <Tab value="raw" class="!px-4 !py-3 !font-medium">Raw HTTP</Tab>
                        </TabList>
                    </div>

                    <!-- Tab Content -->
                    <TabPanels class="flex-1 min-h-0 overflow-hidden bg-surface-900 !p-0">
                        <!-- Overview Tab -->
                        <TabPanel value="overview" class="h-full !p-0">
                            <Splitter class="h-full border-none bg-transparent">
                                <SplitterPanel :size="50" class="p-4 overflow-hidden">
                                    <FieldList :operation="selectedOperation" />
                                </SplitterPanel>
                                <SplitterPanel :size="50" class="p-4 overflow-hidden">
                                     <VariableList :operation="selectedOperation" />
                                </SplitterPanel>
                            </Splitter>
                        </TabPanel>
                        
                        <!-- Requests Tab -->
                        <TabPanel value="requests" class="h-full !p-4 overflow-y-auto">
                            <div class="max-w-4xl mx-auto space-y-3">
                                <RequestCard
                                    v-for="request in selectedRequests"
                                    :key="request.id"
                                    :request="request"
                                    :is-active="request.id === selectedRequestId"
                                    @select="selectRequest"
                                    @details="openRequestDetails"
                                />
                                <div v-if="selectedRequests.length === 0" class="mt-8">
                                     <EmptyState
                                        title="No requests found"
                                        description="No captured requests match this operation."
                                        icon="fas fa-inbox"
                                    />
                                </div>
                            </div>
                        </TabPanel>
                        
                        <!-- Raw HTTP Tab -->
                        <TabPanel value="raw" class="h-full !p-4 overflow-hidden flex flex-col">
                             <Splitter layout="vertical" class="h-full border-none bg-transparent">
                                <SplitterPanel :size="50" class="flex flex-col pb-2">
                                     <h3 class="text-sm font-bold text-surface-300 mb-2 px-1">Request</h3>
                                     <div ref="requestEditorContainer" class="flex-1 border border-surface-700 rounded-lg overflow-hidden bg-surface-950" />
                                </SplitterPanel>
                                <SplitterPanel :size="50" class="flex flex-col pt-2">
                                     <h3 class="text-sm font-bold text-surface-300 mb-2 px-1">Response</h3>
                                     <div ref="responseEditorContainer" class="flex-1 border border-surface-700 rounded-lg overflow-hidden bg-surface-950" />
                                </SplitterPanel>
                             </Splitter>
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </div>
            
            <div v-else class="h-full flex items-center justify-center p-8 bg-surface-50/5 dark:bg-surface-900">
                <div class="text-center opacity-40">
                    <i class="fas fa-arrow-left text-4xl mb-4 block lg:hidden"></i>
                    <i class="fas fa-mouse-pointer text-4xl mb-4 hidden lg:block mx-auto"></i>
                    <h3 class="text-xl font-medium">Select an Operation</h3>
                    <p class="mt-2 text-sm">Choose an operation from the sidebar to view details</p>
                </div>
            </div>
        </SplitterPanel>
      </Splitter>
    </main>
  </div>
</template>


<style>
.cm-editor {
    height: 100% !important;
}
</style>
