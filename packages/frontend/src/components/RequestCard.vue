<script setup lang="ts">
import type { RequestSummary } from "@/types";

defineProps<{
  request: RequestSummary;
  isActive?: boolean;
}>();

const emit = defineEmits<{
  select: [requestId: string];
  details: [requestId: string];
}>();

const getMethodColor = (method: string) => {
  const colors: Record<string, string> = {
    GET: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    POST: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    PUT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    DELETE: "text-red-400 bg-red-500/10 border-red-500/20",
    PATCH: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  return colors[method] !== undefined
    ? colors[method]
    : "text-surface-400 bg-surface-500/10 border-surface-500/20";
};
</script>

<template>
  <div
    class="w-full text-left rounded-lg p-3 transition-all border group flex items-center gap-3"
    :class="[
      isActive
        ? 'bg-surface-800 border-primary-500/50 shadow-sm'
        : 'bg-surface-800/40 border-surface-700/50 hover:bg-surface-800 hover:border-surface-600',
    ]"
    role="button"
    tabindex="0"
    @click="emit('select', request.id)"
    @keydown.enter.prevent="emit('select', request.id)"
    @keydown.space.prevent="emit('select', request.id)"
  >
    <!-- Method Badge -->
    <div
      class="shrink-0 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider border"
      :class="getMethodColor(request.method)"
    >
      {{ request.method }}
    </div>

    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium text-surface-200 truncate font-mono">{{
          request.path
        }}</span>
        <span class="text-[10px] text-surface-500 shrink-0">{{
          request.createdAt
        }}</span>
      </div>
      <p class="text-xs text-surface-500 truncate font-mono opacity-80">
        {{ request.url }}
      </p>
    </div>

    <button
      type="button"
      class="shrink-0 px-2 py-1 text-[10px] font-semibold rounded border border-surface-600 text-surface-200 hover:text-surface-50 hover:border-surface-500 hover:bg-surface-700/60 transition-colors"
      @click.stop="emit('details', request.id)"
    >
      Details
    </button>

    <!-- Active Indicator -->
    <div
      class="shrink-0 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"
      :class="{ 'opacity-100': isActive }"
    >
      <i class="fas fa-chevron-right text-xs"></i>
    </div>
  </div>
</template>
