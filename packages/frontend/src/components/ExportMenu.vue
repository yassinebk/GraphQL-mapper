<script setup lang="ts">
import { ref } from "vue";
import type { OperationSummary } from "@/types";
import Menu from "primevue/menu";
import Button from "primevue/button";

const props = defineProps<{
  operation: OperationSummary | null;
}>();

const emit = defineEmits<{
  toast: [message: string, variant: "success" | "error"];
}>();

const menu = ref();
const items = ref([
  {
    label: 'Copy to Clipboard',
    items: [
      {
        label: 'Operation Signature',
        icon: 'fas fa-copy',
        command: () => exportSignature()
      },
      {
        label: 'Fields List',
        icon: 'fas fa-database',
        command: () => exportFields()
      },
      {
        label: 'Variables List',
        icon: 'fas fa-code',
        command: () => exportVariables()
      },
      {
        label: 'Full JSON',
        icon: 'fas fa-file',
        command: () => exportAsJSON()
      }
    ]
  },
  {
    separator: true
  },
  {
    label: 'Download',
    items: [
      {
        label: 'Download as JSON',
        icon: 'fas fa-download',
        command: () => downloadJSON()
      }
    ]
  }
]);

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    emit("toast", `${label} copied to clipboard`, "success");
  } catch (error) {
    emit("toast", "Failed to copy to clipboard", "error");
  }
};

const exportAsJSON = () => {
  if (!props.operation) return;
  const json = JSON.stringify(props.operation, null, 2);
  copyToClipboard(json, "Operation JSON");
};

const exportSignature = () => {
  if (!props.operation) return;
  copyToClipboard(props.operation.signature, "Operation signature");
};

const exportFields = () => {
  if (!props.operation) return;
  const fields = props.operation.fields
    .map((f) => `${f.path}: ${f.inferredType || "unknown"}`)
    .join("\n");
  copyToClipboard(fields, "Fields");
};

const exportVariables = () => {
  if (!props.operation) return;
  const variables = props.operation.variables
    .map((v) => `$${v.name}: ${v.type}`)
    .join("\n");
  copyToClipboard(variables || "No variables", "Variables");
};

const downloadJSON = () => {
  if (!props.operation) return;
  const json = JSON.stringify(props.operation, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.operation.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
  emit("toast", "JSON file downloaded", "success");
};

const toggle = (event: Event) => {
    menu.value.toggle(event);
};
</script>

<template>
  <div v-if="operation">
    <Button
      type="button"
      icon="fas fa-download"
      label="Export"
      @click="toggle"
      aria-haspopup="true"
      aria-controls="overlay_menu"
      severity="secondary"
      size="small"
      outlined
    />
    <Menu ref="menu" id="overlay_menu" :model="items" :popup="true" />
  </div>
</template>
