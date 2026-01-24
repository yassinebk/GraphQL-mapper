<script setup lang="ts">
import Card from "primevue/card";
import Column from "primevue/column";
import DataTable from "primevue/datatable";

import EmptyState from "./EmptyState.vue";

import type { OperationSummary } from "@/types";

defineProps<{
  operation: OperationSummary | undefined;
}>();
</script>

<template>
  <Card
    class="h-full"
    :pt="{
      body: { class: 'h-full p-0 flex flex-col' },
      content: { class: 'h-full flex flex-col p-0' },
    }"
  >
    <template #title>
      <div class="flex items-center justify-between px-4 pt-4 pb-2">
        <span class="text-lg font-semibold">Variables</span>
        <span v-if="operation" class="text-sm text-surface-400 font-mono">
          {{ operation.variables.length }}
        </span>
      </div>
    </template>
    <template #content>
      <div v-if="operation" class="h-full flex flex-col overflow-hidden">
        <DataTable
          v-if="operation.variables.length > 0"
          :value="operation.variables"
          scrollable
          scroll-height="flex"
          striped-rows
          class="p-datatable-sm border-none flex-1"
          :pt="{
            table: { style: 'min-width: 100%' },
            bodyRow: { class: 'text-sm' },
            headerRow: { class: 'text-xs uppercase text-surface-400' },
          }"
        >
          <Column field="name" header="Name" class="font-mono">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <i class="fas fa-code text-surface-500 text-xs" />
                <span class="truncate text-primary-400">${{ data.name }}</span>
              </div>
            </template>
          </Column>
          <Column field="type" header="Type" class="font-mono w-[120px]">
            <template #body="{ data }">
              <span class="text-surface-300">
                {{ data.type }}
              </span>
            </template>
          </Column>
        </DataTable>

        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center p-4"
        >
          <EmptyState
            title="No variables"
            description="No variables declared"
            icon="fas fa-code"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
