import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import { SDKPlugin } from "./plugins/sdk";
import "./styles/index.css";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

const COMMAND_ID_EXTRACT_HISTORY = "graphql-mapper.extract-history";
const COMMAND_ID_EXTRACT_SELECTED = "graphql-mapper.extract-selection";

// This is the entry point for the frontend plugin
export const init = (sdk: FrontendSDK) => {
  const app = createApp(App);

  // Load the PrimeVue component library
  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  // Provide the FrontendSDK
  app.use(SDKPlugin, sdk);

  // Create the root element for the app
  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  // Set the ID of the root element
  // Replace this with the value of the prefixWrap plugin in caido.config.ts
  // This is necessary to prevent styling conflicts between plugins
  root.id = `plugin--graphql-mapper`;

  // Mount the app to the root element
  app.mount(root);

  // Add the page to the navigation
  // Make sure to use a unique name for the page
  sdk.navigation.addPage("/graphql-mapper", {
    body: root,
  });

  // Add a sidebar item
  sdk.sidebar.registerItem("GraphQL Mapper", "/graphql-mapper");

  sdk.commands.register(COMMAND_ID_EXTRACT_HISTORY, {
    name: "GraphQL Mapper: Extract GraphQL requests",
    group: "GraphQL Mapper",
    run: async () => {
      const result = await sdk.backend.extractInScopeRequests({
        pageSize: 500,
        maxRequests: 5000,
      });
      if (result.kind === "Error") {
        sdk.window.showToast(result.error, { variant: "error" });
        return;
      }

      sdk.window.showToast(
        `Extracted ${result.value.counts.graphql} GraphQL requests from ${result.value.counts.scanned} in-scope.`,
        { variant: "success" },
      );

      sdk.navigation.goTo("/graphql-mapper");
    },
  });

  sdk.commands.register(COMMAND_ID_EXTRACT_SELECTED, {
    name: "GraphQL Mapper: Extract Selected Requests",
    group: "GraphQL Mapper",
    run: async (context) => {
      if (context.type !== "RequestRowContext") {
        sdk.window.showToast("Select one or more requests first", {
          variant: "warning",
        });
        return;
      }

      const ids = context.requests.map((r) => r.id);

      if (ids.length === 0) {
        sdk.window.showToast(
          "Select request rows or a response to extract GraphQL data.",
          {
            variant: "warning",
          },
        );
        return;
      }

      const result = await sdk.backend.extractRequestsById({ requestIds: ids });
      if (result.kind === "Error") {
        sdk.window.showToast(result.error, { variant: "error" });
        return;
      }

      sdk.window.showToast(
        `Extracted ${result.value.counts.graphql} GraphQL requests from ${ids.length} selected.`,
        { variant: "success" },
      );

      sdk.navigation.goTo("/graphql-mapper");
    },
  });

  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: COMMAND_ID_EXTRACT_SELECTED,
    leadingIcon: "fas fa-magnifying-glass",
  });

  sdk.commandPalette.register(COMMAND_ID_EXTRACT_HISTORY);
  sdk.commandPalette.register(COMMAND_ID_EXTRACT_SELECTED);
};
