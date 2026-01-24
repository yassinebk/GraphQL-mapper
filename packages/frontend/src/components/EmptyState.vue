<script setup lang="ts">
import Button from "primevue/button";

defineProps<{
  title: string;
  description: string;
  icon?: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center p-8 h-full min-h-[280px]"
  >
    <div
      class="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mb-6 text-primary-400 border border-surface-700"
    >
      <i :class="icon || 'fas fa-inbox'" class="text-2xl" />
    </div>
    <h3 class="text-lg font-semibold text-surface-200 mb-2">{{ title }}</h3>
    <p class="text-sm text-surface-400 max-w-sm mx-auto mb-6 leading-relaxed">
      {{ description }}
    </p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      severity="primary"
      size="small"
      icon="fas fa-arrow-right"
      @click="emit('action')"
    />
  </div>
</template>
