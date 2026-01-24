const inferJsonType = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value;
};

export const collectResponseFieldTypes = (
  value: unknown,
  prefix = "",
): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  const visit = (data: unknown, path: string) => {
    const type = inferJsonType(data);
    if (path.length > 0) {
      const existing = map.get(path) ?? new Set<string>();
      existing.add(type);
      map.set(path, existing);
    }
    if (
      data !== null &&
      data !== undefined &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      for (const [key, child] of Object.entries(data)) {
        const nextPath = path ? `${path}.${key}` : key;
        visit(child, nextPath);
      }
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        visit(item, path);
      }
    }
  };
  visit(value, prefix);
  return map;
};

export const mergeFieldTypes = (
  target: Map<string, Set<string>>,
  source: Map<string, Set<string>>,
) => {
  for (const [path, types] of source.entries()) {
    const entry = target.get(path) ?? new Set<string>();
    for (const value of types) {
      entry.add(value);
    }
    target.set(path, entry);
  }
};

export const formatFieldTypes = (types?: Set<string>) => {
  if (!types || types.size === 0) {
    return undefined;
  }
  return Array.from(types).sort().join(" | ");
};
