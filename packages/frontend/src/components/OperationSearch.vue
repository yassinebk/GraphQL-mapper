<script setup lang="ts">
import InputText from "primevue/inputtext";
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: string;
  filterKind: "all" | "query" | "mutation" | "subscription";
  totalCount: number;
  filteredCount: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:filterKind": [kind: "all" | "query" | "mutation" | "subscription"];
}>();

const localSearch = ref(props.modelValue);

watch(localSearch, (value) => {
  emit("update:modelValue", value);
});

watch(() => props.modelValue, (value) => {
  localSearch.value = value;
});

const kinds = [
  { value: "all", label: "All", icon: "fas fa-list" },
  { value: "query", label: "Query", icon: "fas fa-search" },
  { value: "mutation", label: "Mutation", icon: "fas fa-pencil" },
  { value: "subscription", label: "Sub", icon: "fas fa-bell" },
] as const;
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative">
      <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm pointer-events-none" />
      <InputText
        v-model="localSearch"
        placeholder="Filter operations..."
        class="w-full pl-9"
        size="small"
      />
      <button
        v-if="localSearch"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-surface-400 hover:text-surface-200 cursor-pointer"
        @click="localSearch = ''"
      >
        <i class="fas fa-times text-xs" />
      </button>
    </div>

    <div class="flex items-center justify-between gap-2 overflow-x-auto">
      <div class="flex gap-1">
        <button
            v-for="kind in kinds"
            :key="kind.value"
            @click="emit('update:filterKind', kind.value)"
            class="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border whitespace-nowrap"
            :class="[
                filterKind === kind.value 
                    ? 'bg-surface-700 text-primary-400 border-surface-600' 
                    : 'bg-transparent text-surface-400 border-transparent hover:bg-surface-800 hover:text-surface-200'
            ]"
        >
            <i :class="[kind.icon, 'text-[10px]']"></i>
            {{ kind.label }}
        </button>
      </div>
      
      <span v-if="localSearch || filterKind !== 'all'" class="text-xs text-surface-500 font-mono whitespace-nowrap">
        {{ filteredCount }} / {{ totalCount }}
      </span>
    </div>
  </div>
</template>
