# VueJS Frontend Template

This template should be used as a starting point for creating a new plugin with a VueJS frontend.

## Features

- [pnpm](https://pnpm.io/) as package manager
- [TypeScript](https://www.typescriptlang.org/)
- [VueJS](https://vuejs.org/)
- [PrimeVue](https://primevue.org/) for UI components


--- 
This plugin allows the mapping of graphql endpoints:

1. Extract all the graphql HTTP requests from the proxy history. 
2. Map the extract requests to the idfferent mutations and queries.
3. Give a visual representation of the graphql schema.
4. Maps the types based on the extracted requests.
5. Show all the queries and mutations with their parameters and types. ( deduplicated )
