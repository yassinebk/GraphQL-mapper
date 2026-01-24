import { ref } from "vue";
import type { FrontendSDK } from "@/types";

export const useEditorManagement = (sdk: FrontendSDK) => {
  const requestEditorContainer = ref<HTMLDivElement | null>(null);
  const responseEditorContainer = ref<HTMLDivElement | null>(null);
  const requestEditor = ref<ReturnType<typeof sdk.ui.httpRequestEditor> | null>(null);
  const responseEditor = ref<ReturnType<typeof sdk.ui.httpResponseEditor> | null>(null);

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

  const initializeEditors = () => {
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
  };

  return {
    requestEditorContainer,
    responseEditorContainer,
    requestEditor,
    responseEditor,
    setEditorText,
    setResponseText,
    initializeEditors,
  };
};
