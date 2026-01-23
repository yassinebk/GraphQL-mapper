<script setup lang="ts">
import type { OperationSummary } from "@/types";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Card from "primevue/card";
import EmptyState from "./EmptyState.vue";

defineProps<{
  operation: OperationSummary | null | undefined;
}>();
</script>

<template>
  <Card class="h-full" :pt="{ body: { class: 'h-full p-0 flex flex-col' }, content: { class: 'h-full flex flex-col p-0' } }">
    <template #title>
      <div class="flex items-center justify-between px-4 pt-4 pb-2">
        <span class="text-lg font-semibold">Fields</span>
        <span v-if="operation" class="text-sm text-surface-400 font-mono">
          {{ operation.fields.length }}
        </span>
      </div>
    </template>
    <template #content>
      <div v-if="operation" class="h-full flex flex-col overflow-hidden">
        <DataTable
            v-if="operation.fields.length > 0"
            :value="operation.fields"
            scrollable
            scrollHeight="flex"
            stripedRows
            class="p-datatable-sm border-none flex-1"
            :pt="{
                table: { style: 'min-width: 100%' },
                bodyRow: { class: 'text-sm' },
                headerRow: { class: 'text-xs uppercase text-surface-400' }
            }"
        >
          <Column field="path" header="Path" class="font-mono">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <i class="fas fa-database text-surface-500 text-xs" />
                <span class="truncate">{{ data.path }}</span>
              </div>
            </template>
          </Column>
          <Column field="inferredType" header="Type" class="font-mono w-[120px]">
             <template #body="{ data }">
                <span v-if="data.inferredType" class="text-surface-300">
                  {{ data.inferredType }}
                </span>
             </template>
          </Column>
        </DataTable>
        
        <div v-else class="flex-1 flex flex-col items-center justify-center p-4">
            <EmptyState
                title="No fields"
                description="No fields parsed"
                icon="fas fa-database"
            />
        </div>
      </div>
    </template>
  </Card>
</template>
