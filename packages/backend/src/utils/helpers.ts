import type { Result } from "@graphql-mapper/shared";

export const ok = <T>(value: T): Result<T> => ({ kind: "Ok", value });
export const err = (message: string): Result<never> => ({
  kind: "Error",
  error: message,
});

export const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const previewText = (value: string | undefined, limit = 300) => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
};

export const extractRawBody = (rawText: string) => {
  const separatorIndex = rawText.indexOf("\r\n\r\n");
  const headerEndIndex =
    separatorIndex === -1 ? rawText.indexOf("\n\n") : separatorIndex;
  if (headerEndIndex === -1) {
    return "";
  }
  return rawText.slice(headerEndIndex + (separatorIndex === -1 ? 2 : 4));
};
