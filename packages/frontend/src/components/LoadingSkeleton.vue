<script setup lang="ts">
import Skeleton from 'primevue/skeleton';

defineProps<{
  count?: number;
  type?: "card" | "list" | "text";
}>();
</script>

<template>
  <div class="flex flex-col gap-4 py-2">
    <template v-for="i in count || 3" :key="i">
      
      <!-- Card Type (Default) -->
      <div v-if="!type || type === 'card'" class="p-4 rounded-xl border border-surface-700 bg-surface-800">
        <div class="flex items-start gap-4 mb-4">
          <Skeleton shape="rectangle" width="2.25rem" height="2.25rem" class="rounded-lg !bg-surface-700" />
          <div class="flex-1 flex flex-col gap-2">
            <Skeleton width="60%" height="0.875rem" class="!bg-surface-700" />
            <Skeleton width="80%" height="0.625rem" class="!bg-surface-700" />
          </div>
        </div>
        <div class="flex gap-4 pt-2 border-t border-surface-700">
          <Skeleton width="5rem" height="0.625rem" class="!bg-surface-700" />
          <Skeleton width="5rem" height="0.625rem" class="!bg-surface-700" />
          <Skeleton width="5rem" height="0.625rem" class="!bg-surface-700" />
        </div>
      </div>

      <!-- List Type -->
      <div v-else-if="type === 'list'" class="p-3 rounded-xl bg-surface-800 flex flex-col gap-2">
        <Skeleton width="100%" height="0.75rem" class="!bg-surface-700" />
        <Skeleton width="65%" height="0.75rem" class="!bg-surface-700" />
      </div>

      <!-- Text Type -->
      <Skeleton v-else width="100%" height="0.75rem" class="!bg-surface-700" />
      
    </template>
  </div>
</template>
