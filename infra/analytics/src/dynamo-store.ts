import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type GetCommandInput,
  type PutCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import type {
  CompareResult,
  GuardRecord,
  PageViewStore,
  PutResult,
  ReadResult,
  StoredEvent,
  VisitorStateStore,
} from "@/lib/analytics/recovery";
import type { DayRecord, VisitorProfile } from "@/lib/analytics/visitor";

const DAY_PREFIX = "DAY#";
const DAY_QUERY_LIMIT = 90;

export type DynamoRequest = {
  put(input: Record<string, unknown>): Promise<void>;
  get(input: Record<string, unknown>): Promise<{ Item?: Record<string, unknown> }>;
  update(input: Record<string, unknown>): Promise<void>;
  query(
    input: Record<string, unknown>,
  ): Promise<{ Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> }>;
};

type AttributeValue = string | number | boolean;

function conditionalConflict(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException";
}

async function putNew(dynamo: DynamoRequest, tableName: string, item: Record<string, AttributeValue>): Promise<PutResult> {
  try {
    await dynamo.put({
      TableName: tableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(visitorId)",
    });
    return "created";
  } catch (error) {
    return conditionalConflict(error) ? "exists" : "failed";
  }
}

async function readItem<T>(
  dynamo: DynamoRequest,
  tableName: string,
  key: Record<string, string>,
): Promise<ReadResult<T>> {
  try {
    const result = await dynamo.get({
      TableName: tableName,
      Key: key,
      ConsistentRead: true,
    });
    return { ok: true, item: (result.Item as T | undefined) ?? null };
  } catch {
    return { ok: false };
  }
}

function namesAndValues(fields: Record<string, AttributeValue>): {
  names: Record<string, string>;
  values: Record<string, AttributeValue>;
  assignments: string[];
} {
  const names: Record<string, string> = {};
  const values: Record<string, AttributeValue> = {};
  const assignments: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const name = `#${field}`;
    const token = `:${field}`;
    names[name] = field;
    values[token] = value;
    assignments.push(`${name} = ${token}`);
  }
  return { names, values, assignments };
}

function storedFields(item: object): Record<string, AttributeValue> {
  const stored: Record<string, AttributeValue> = {};
  for (const [field, value] of Object.entries(item)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") stored[field] = value;
  }
  return stored;
}

async function compareItem(
  dynamo: DynamoRequest,
  tableName: string,
  key: Record<string, string>,
  expected: object | null,
  next: object,
  versionFields: string[],
  removable: string[],
): Promise<CompareResult> {
  const expectedFields = expected ? storedFields(expected) : null;
  const mutable = storedFields(next);
  delete mutable.visitorId;
  delete mutable.itemKey;
  const { names, values, assignments } = namesAndValues(mutable);
  const remove = removable.filter((field) => expectedFields?.[field] !== undefined && mutable[field] === undefined);
  for (const field of remove) names[`#${field}`] = field;
  let condition = "attribute_not_exists(visitorId)";
  if (expectedFields) {
    const checks = versionFields.map((field) => {
      names[`#${field}`] = field;
      values[`:read_${field}`] = expectedFields[field] as AttributeValue;
      return `#${field} = :read_${field}`;
    });
    condition = checks.join(" AND ");
  }
  const update = [`SET ${assignments.join(", ")}`];
  if (remove.length > 0) update.push(`REMOVE ${remove.map((field) => `#${field}`).join(", ")}`);
  try {
    await dynamo.update({
      TableName: tableName,
      Key: key,
      ConditionExpression: condition,
      UpdateExpression: update.join(" "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    });
    return "applied";
  } catch (error) {
    return conditionalConflict(error) ? "conflict" : "failed";
  }
}

function withoutEmpty(item: object): Record<string, AttributeValue> {
  return storedFields(item);
}

export function analyticsStores(
  visitorsTable: string,
  pageViewsTable: string,
  dynamo: DynamoRequest,
): { pageViews: PageViewStore; visitors: VisitorStateStore } {
  const pageViews: PageViewStore = {
    putGuard: (guard) => putNew(dynamo, pageViewsTable, guard),
    getGuard: (visitorId, eventId) =>
      readItem<GuardRecord>(dynamo, pageViewsTable, { visitorId, eventSort: `ID#${eventId}` }),
    putEvent: (event) => putNew(dynamo, pageViewsTable, withoutEmpty(event)),
    getEvent: (visitorId, eventSort) =>
      readItem<StoredEvent>(dynamo, pageViewsTable, { visitorId, eventSort }),
  };
  const visitors: VisitorStateStore = {
    getProfile: (visitorId) =>
      readItem<VisitorProfile>(dynamo, visitorsTable, { visitorId, itemKey: "PROFILE" }),
    compareProfile: (expected, next) =>
      compareItem(
        dynamo,
        visitorsTable,
        { visitorId: next.visitorId, itemKey: "PROFILE" },
        expected,
        next,
        ["firstSeenAt", "lastSeenAt"],
        ["firstCampaign", "latestCampaign"],
      ),
    getDay: (visitorId, day) =>
      readItem<DayRecord>(dynamo, visitorsTable, { visitorId, itemKey: `${DAY_PREFIX}${day}` }),
    compareDay: (expected, next) =>
      compareItem(
        dynamo,
        visitorsTable,
        { visitorId: next.visitorId, itemKey: next.itemKey },
        expected,
        next,
        ["dayFirstAt", "lastEventAt", "firstSeenDay"],
        [],
      ),
    listDays: async (visitorId) => {
      try {
        const result = await dynamo.query({
          TableName: visitorsTable,
          KeyConditionExpression: "visitorId = :visitorId AND begins_with(itemKey, :dayPrefix)",
          ExpressionAttributeValues: {
            ":visitorId": visitorId,
            ":dayPrefix": DAY_PREFIX,
          },
          ConsistentRead: true,
          Limit: DAY_QUERY_LIMIT,
        });
        if (result.LastEvaluatedKey) return { ok: false };
        return { ok: true, item: (result.Items as DayRecord[] | undefined) ?? [] };
      } catch {
        return { ok: false };
      }
    },
  };
  return { pageViews, visitors };
}

export function documentRequests(client = DynamoDBDocumentClient.from(new DynamoDBClient({}))): DynamoRequest {
  return {
    put: async (input) => {
      await client.send(new PutCommand(input as PutCommandInput));
    },
    get: async (input) => client.send(new GetCommand(input as GetCommandInput)),
    update: async (input) => {
      await client.send(new UpdateCommand(input as UpdateCommandInput));
    },
    query: async (input) => client.send(new QueryCommand(input as QueryCommandInput)),
  };
}
