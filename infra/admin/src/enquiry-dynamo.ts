import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  type GetCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  type EnquiryPage,
  type EnquiryQuery,
  type EnquiryStore,
  type NotificationStatus,
  type ReviewStatus,
  type StoredEnquiry,
  deliveryFields,
  isEnquiryId,
  notificationStatus,
} from "./enquiries";

const INDEX = "notification-due";
const COUNT_PAGES = 25;

export class EnquiryUnavailable extends Error {
  constructor() {
    super("enquiry_unavailable");
  }
}

type QueryResult = {
  Items?: Record<string, unknown>[];
  Count?: number;
  LastEvaluatedKey?: Record<string, unknown>;
};

export type EnquiryDynamo = {
  query(input: Record<string, unknown>): Promise<QueryResult>;
  get(input: Record<string, unknown>): Promise<{ Item?: Record<string, unknown> }>;
  update(input: Record<string, unknown>): Promise<{ Attributes?: Record<string, unknown> }>;
};

export function enquiryStore(tableName: string, dynamo: EnquiryDynamo): EnquiryStore {
  return {
    async count(status) {
      let total = 0;
      let start: Record<string, unknown> | undefined;
      for (let page = 0; page < COUNT_PAGES; page += 1) {
        const result = await dynamo.query({
          TableName: tableName,
          IndexName: INDEX,
          KeyConditionExpression: "#status = :status",
          ExpressionAttributeNames: { "#status": "notificationStatus" },
          ExpressionAttributeValues: { ":status": status },
          Select: "COUNT",
          ...(start ? { ExclusiveStartKey: start } : {}),
        });
        total += result.Count ?? 0;
        if (!result.LastEvaluatedKey) return total;
        start = result.LastEvaluatedKey;
      }
      throw new EnquiryUnavailable();
    },
    async list(query) {
      const names: Record<string, string> = { "#status": "notificationStatus" };
      const values: Record<string, string> = { ":status": query.status };
      const filter = filterExpression(query, names, values);
      const result = await dynamo.query({
        TableName: tableName,
        IndexName: INDEX,
        KeyConditionExpression: "#status = :status",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ScanIndexForward: false,
        Limit: query.limit,
        ...(filter ? { FilterExpression: filter } : {}),
        ...(query.cursor
          ? {
              ExclusiveStartKey: {
                notificationStatus: query.status,
                notificationDueAt: query.cursor.notificationDueAt,
                idempotencyKey: query.cursor.idempotencyKey,
              },
            }
          : {}),
      });
      const items = (result.Items ?? [])
        .map(readEnquiry)
        .filter((item): item is StoredEnquiry => item !== null);
      const cursor = readPageKey(result.LastEvaluatedKey, query.status);
      return { items, ...(cursor ? { cursor } : {}) } satisfies EnquiryPage;
    },
    async get(id) {
      const result = await dynamo.get({
        TableName: tableName,
        Key: { idempotencyKey: id },
      });
      return readEnquiry(result.Item);
    },
    async setReview(id, review, now) {
      try {
        const result = await dynamo.update({
          TableName: tableName,
          Key: { idempotencyKey: id },
          UpdateExpression: "SET reviewStatus = :review, reviewUpdatedAt = :now",
          ConditionExpression: "attribute_exists(idempotencyKey)",
          ExpressionAttributeValues: { ":review": review, ":now": now },
          ReturnValues: "ALL_NEW",
        });
        return readEnquiry(result.Attributes);
      } catch (error) {
        if (error instanceof Error && error.name === "ConditionalCheckFailedException") return null;
        throw error;
      }
    },
  };
}

export function createDynamoEnquiryStore(tableName: string): EnquiryStore {
  const document = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const dynamo: EnquiryDynamo = {
    query: (input) => document.send(new QueryCommand(input as QueryCommandInput)),
    get: (input) => document.send(new GetCommand(input as GetCommandInput)),
    update: (input) => document.send(new UpdateCommand(input as UpdateCommandInput)),
  };
  const store = enquiryStore(tableName, dynamo);
  return {
    count: (status) => guard(() => store.count(status)),
    list: (query) => guard(() => store.list(query)),
    get: (id) => guard(() => store.get(id)),
    setReview: (id, review, now) => guard(() => store.setReview(id, review, now)),
  };
}

function filterExpression(
  query: EnquiryQuery,
  names: Record<string, string>,
  values: Record<string, string>,
): string {
  const parts: string[] = [];
  if (query.q) {
    names["#email"] = "email";
    names["#name"] = "name";
    names["#organisation"] = "organisation";
    values[":q"] = query.q;
    parts.push("(contains(#email, :q) OR contains(#name, :q) OR contains(#organisation, :q))");
  }
  if (query.review === "new") {
    names["#review"] = "reviewStatus";
    values[":review"] = "new";
    parts.push("(attribute_not_exists(#review) OR #review = :review)");
  } else if (query.review) {
    names["#review"] = "reviewStatus";
    values[":review"] = query.review;
    parts.push("#review = :review");
  }
  return parts.join(" AND ");
}

function readPageKey(
  key: Record<string, unknown> | undefined,
  status: NotificationStatus,
): EnquiryPage["cursor"] {
  if (!key) return undefined;
  if (
    key.notificationStatus !== status ||
    typeof key.notificationDueAt !== "string" ||
    typeof key.idempotencyKey !== "string" ||
    !isEnquiryId(key.idempotencyKey)
  ) {
    throw new EnquiryUnavailable();
  }
  return {
    notificationDueAt: key.notificationDueAt,
    idempotencyKey: key.idempotencyKey,
  };
}

function readEnquiry(item: Record<string, unknown> | undefined): StoredEnquiry | null {
  if (!item) return null;
  const status = typeof item.notificationStatus === "string" ? notificationStatus(item.notificationStatus) : null;
  if (
    typeof item.idempotencyKey !== "string" ||
    !isEnquiryId(item.idempotencyKey) ||
    typeof item.createdAt !== "string" ||
    typeof item.notificationDueAt !== "string" ||
    typeof item.name !== "string" ||
    typeof item.organisation !== "string" ||
    typeof item.email !== "string" ||
    typeof item.enquiryType !== "string" ||
    typeof item.message !== "string" ||
    !status ||
    !(item.phone === null || typeof item.phone === "string")
  ) {
    return null;
  }
  return {
    idempotencyKey: item.idempotencyKey,
    createdAt: item.createdAt,
    notificationDueAt: item.notificationDueAt,
    name: item.name,
    organisation: item.organisation,
    email: item.email,
    phone: item.phone,
    enquiryType: item.enquiryType,
    message: item.message,
    notificationStatus: status,
    ...(typeof item.reviewStatus === "string" ? { reviewStatus: item.reviewStatus } : {}),
    ...deliveryFields(item),
  };
}

async function guard<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof EnquiryUnavailable) throw error;
    throw new EnquiryUnavailable();
  }
}

export type { ReviewStatus };
