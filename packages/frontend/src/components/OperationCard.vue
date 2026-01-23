<script setup lang="ts">
import type { OperationSummary } from "@/types";

defineProps<{
  operation: OperationSummary;
  isActive?: boolean;
}>();

const emit = defineEmits<{
  select: [operation: OperationSummary];
}>();
</script>

<template>
  <button
    class="w-full text-left rounded-lg p-3 transition-colors border group relative overflow-hidden"
    :class="[
        isActive 
            ? 'bg-surface-700 border-primary-500/50' 
            : 'bg-surface-800 border-surface-700 hover:bg-surface-700 hover:border-surface-600'
    ]"
    @click="emit('select', operation)"
  >
    <!-- Left Border Highlight for Active State -->
    <div 
        v-if="isActive" 
        class="absolute left-0 top-0 bottom-0 w-1 bg-primary-500"
    ></div>

    <div class="flex items-start gap-3 pl-2">
      <!-- Icon -->
      <div 
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        :class="isActive ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-700 text-surface-400 group-hover:bg-surface-600 group-hover:text-surface-300'"
      >
        <i
          :class="{
            'fas fa-search': operation.kind === 'query',
            'fas fa-pencil': operation.kind === 'mutation',
            'fas fa-bell': operation.kind === 'subscription',
          }"
          class="text-xs"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-sm font-medium text-surface-100 truncate">
            {{ operation.name }}
          </span>
          <span class="text-[10px] uppercase font-bold text-surface-500 bg-surface-900 px-1.5 py-0.5 rounded">
            {{ operation.kind.substring(0, 3) }}
          </span>
        </div>
        
        <p class="text-xs text-surface-400 font-mono truncate opacity-60 mb-2">
            {{ operation.signature }}
        </p>

        <!-- Stats -->
        <div class="flex items-center gap-3 text-[10px] text-surface-500">
            <span class="flex items-center gap-1">
                <i class="fas fa-database opacity-70"></i> {{ operation.fields.length }}
            </span>
            <span class="flex items-center gap-1">
                <i class="fas fa-code opacity-70"></i> {{ operation.variables.length }}
            </span>
            <span class="flex items-center gap-1">
                <i class="fas fa-file opacity-70"></i> {{ operation.requestIds.length }}
            </span>
        </div>
      </div>
    </div>
  </button>
</template>
