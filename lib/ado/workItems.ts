import { adoFetch, projectUrl, batchAsync } from "./client";
import type { AdoConfig, ExpenseType } from "./types";

interface WorkItem {
  id: number;
  fields: {
    "System.Title"?: string;
    "System.WorkItemType"?: string;
    "System.Parent"?: number;
    "Custom.FeatureExpense"?: string;
    "System.AreaPath"?: string;
  };
}

interface WorkItemsResponse {
  count: number;
  value: WorkItem[];
}

export interface ResolvedFeature {
  featureId: number | null;
  featureTitle: string;
  expenseType: ExpenseType;
}

const FIELDS = "System.Title,System.WorkItemType,System.Parent,Custom.FeatureExpense,System.AreaPath";
const BATCH_SIZE = 200;
const BATCH_CONCURRENCY = 3;

export async function getWorkItems(
  config: AdoConfig,
  ids: number[]
): Promise<Map<number, WorkItem>> {
  const result = new Map<number, WorkItem>();
  if (ids.length === 0) return result;

  // Deduplicate
  const uniqueIds = [...new Set(ids)];

  // Split into batches of 200
  const batches: number[][] = [];
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  const fetchBatch = (batchIds: number[]) => async () => {
    const idParam = batchIds.join(",");
    const url = projectUrl(
      config,
      `_apis/wit/workitems?ids=${idParam}&fields=${FIELDS}&api-version=7.1`
    );
    const data = await adoFetch<WorkItemsResponse>(config, url);
    return data.value;
  };

  const batchResults = await batchAsync(
    batches.map((b) => fetchBatch(b)),
    BATCH_CONCURRENCY
  );

  for (const items of batchResults) {
    for (const item of items) {
      result.set(item.id, item);
    }
  }

  return result;
}

export async function resolveFeature(
  config: AdoConfig,
  workItemId: number,
  cache: Map<number, WorkItem>,
  maxDepth = 5
): Promise<ResolvedFeature> {
  let currentId: number | undefined = workItemId;
  let depth = 0;

  while (currentId !== undefined && depth < maxDepth) {
    // Fetch if not cached
    if (!cache.has(currentId)) {
      const fetched = await getWorkItems(config, [currentId]);
      for (const [id, item] of fetched) {
        cache.set(id, item);
      }
    }

    const item = cache.get(currentId);
    if (!item) break;

    const type = item.fields["System.WorkItemType"];

    if (type === "Feature") {
      const rawExpense = item.fields["Custom.FeatureExpense"];
      let expenseType: ExpenseType = "Unclassified";
      if (rawExpense === "CapEx" || rawExpense === "OpEx") {
        expenseType = rawExpense;
      }
      return {
        featureId: item.id,
        featureTitle: item.fields["System.Title"] || `Feature ${item.id}`,
        expenseType,
      };
    }

    // Walk up to parent
    currentId = item.fields["System.Parent"];
    depth++;
  }

  return {
    featureId: null,
    featureTitle: "No Feature",
    expenseType: "Unclassified",
  };
}
