import { type Caido } from "@caido/sdk-frontend";
import type {
  API,
  ExtractionStatus,
  GraphQLModel,
  OperationSummary,
  RequestDetails,
  RequestSummary,
  Result,
} from "backend";

export type FrontendSDK = Caido<API, Record<string, never>>;

export type {
  ExtractionStatus,
  GraphQLModel,
  OperationSummary,
  RequestDetails,
  RequestSummary,
  Result,
};
