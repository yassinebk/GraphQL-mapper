import { type Caido } from "@caido/sdk-frontend";
import type {
  ExtractionStatus,
  GraphQLModel,
  OperationSummary,
  RequestDetails,
  RequestSummary,
  Result,
} from "@graphql-mapper/shared";
import type { API } from "graphql-mapper-backend";

export type FrontendSDK = Caido<API, Record<string, never>>;

export type {
  ExtractionStatus,
  GraphQLModel,
  OperationSummary,
  RequestDetails,
  RequestSummary,
  Result,
};
