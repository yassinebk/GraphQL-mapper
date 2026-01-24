<script setup lang="ts">
import Card from "primevue/card";
import { computed } from "vue";

import EmptyState from "./EmptyState.vue";

import type { OperationSummary } from "@/types";

const props = defineProps<{
  operation: OperationSummary | undefined;
}>();

const formattedFields = computed(() => {
  if (!props.operation || props.operation.fields.length === 0) {
    return [];
  }

  return props.operation.fields.map(
    (field: { path: string; inferredType?: string }) => {
      const parts = field.path.split(".");
      const fieldName = parts[parts.length - 1];
      const indentLevel = parts.length - 1;
      const type =
        field.inferredType !== undefined ? field.inferredType : "Unknown";

      return {
        fieldName,
        type,
        indentLevel,
      };
    },
  );
});
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
        <span class="text-lg font-semibold">Fields</span>
        <span v-if="operation" class="text-sm text-surface-400 font-mono">
          {{ operation.fields.length }}
        </span>
      </div>
    </template>
    <template #content>
      <div v-if="operation" class="h-full flex flex-col overflow-hidden">
        <div
          v-if="operation.fields.length > 0"
          class="flex-1 overflow-auto p-4"
        >
          <div
            class="font-mono text-sm bg-surface-950 p-4 rounded-lg border border-surface-700"
          >
            <div
              v-for="(field, index) in formattedFields"
              :key="index"
              class="leading-relaxed"
            >
              <span :style="{ paddingLeft: `${field.indentLevel * 1.5}rem` }">
                <span class="text-cyan-400">{{ field.fieldName }}</span
                ><span class="text-surface-500">:</span>
                <span class="text-amber-400">{{ field.type }}</span>
              </span>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center p-4"
        >
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
