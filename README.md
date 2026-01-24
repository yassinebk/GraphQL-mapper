# GraphQL Mapper

A Caido community plugin for mapping and visualizing GraphQL endpoints.

## Features

This plugin allows the mapping of GraphQL endpoints:

1. Extract all the GraphQL HTTP requests from the proxy history
2. Map the extracted requests to the different mutations and queries
3. Give a visual representation of the GraphQL schema
4. Map the types based on the extracted requests
5. Show all the queries and mutations with their parameters and types (deduplicated)

## Technology Stack

- [pnpm](https://pnpm.io/) as package manager
- [TypeScript](https://www.typescriptlang.org/)
- [VueJS](https://vuejs.org/)
- [PrimeVue](https://primevue.org/) for UI components

## Installation

This is a Caido community plugin. Install it through the Caido plugin manager.

## Development

```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Watch mode for development
pnpm watch
```

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

fir3cr4ckers <fir3cr4ckers@proton.me>
