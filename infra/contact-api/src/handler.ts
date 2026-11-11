import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import nodemailer from "nodemailer";
import {
  LOCK_TIMEOUT_MS,
  enquirySubject,
  enquiryText,
  processEnquiry,
  retryDueNotifications,
  type ContactHttpEvent,
  type LeadRecord,
  type LeadStore,
} from "./process-enquiry";

const tableName = process.env.LEADS_TABLE_NAME ?? "";
const secretArn = process.env.SMTP_SECRET_ARN ?? "";
const smtpFrom = process.env.SMTP_FROM ?? "enquiries@occasionfun.co.uk";
const smtpTo = (
  process.env.SMTP_TO ??
  "dgv@mydgv.com,priya.yadav@mydgv.com,nitin.bhatt@mydgv.com,prashant@occasionfun.co.uk"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});

type SmtpSettings = {
  hostname: string;
  port: number;
  username: string;
  password: string;
};

function isConditionalConflict(error: unknown): boolean {
  return (
    error instanceof Error && error.name === "ConditionalCheckFailedException"
  );
}

function claimCondition(respectSchedule: boolean): string {
  if (respectSchedule) {
    return "(notificationStatus = :pending AND notificationDueAt <= :now) OR (notificationStatus = :sending AND notificationDueAt <= :staleBefore)";
  }
  return "(notificationStatus = :pending) OR (notificationStatus = :sending AND notificationDueAt <= :staleBefore)";
}

const store: LeadStore = {
  async insert(lead) {
    try {
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: lead,
          ConditionExpression: "attribute_not_exists(idempotencyKey)",
        }),
      );
      return "created";
    } catch (error) {
      if (isConditionalConflict(error)) return "duplicate";
      throw error;
    }
  },
  async read(idempotencyKey) {
    const result = await dynamo.send(
      new GetCommand({
        TableName: tableName,
        Key: { idempotencyKey },
      }),
    );
    return (result.Item as LeadRecord | undefined) ?? null;
  },
  async claim(idempotencyKey, owner, now, options) {
    const nowIso = now.toISOString();
    const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString();
    try {
      const result = await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { idempotencyKey },
          ConditionExpression: claimCondition(options.respectSchedule),
          UpdateExpression:
            "ADD notificationAttempts :one SET notificationStatus = :sending, sendingStartedAt = :now, sendingOwner = :owner, notificationDueAt = :now",
          ExpressionAttributeValues: {
            ":pending": "pending",
            ":sending": "sending",
            ":one": 1,
            ":now": nowIso,
            ":staleBefore": staleBefore,
            ":owner": owner,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      return { outcome: "claimed", lead: result.Attributes as LeadRecord };
    } catch (error) {
      if (!isConditionalConflict(error)) throw error;
      const current = await this.read(idempotencyKey);
      if (!current) return { outcome: "missing" };
      if (current.notificationStatus === "sent") {
        return { outcome: "sent", lead: current };
      }
      if (current.notificationStatus === "failed") {
        return { outcome: "failed", lead: current };
      }
      return { outcome: "busy", lead: current };
    }
  },
  async markSent(idempotencyKey, owner) {
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { idempotencyKey },
          ConditionExpression:
            "notificationStatus = :sending AND sendingOwner = :owner",
          UpdateExpression:
            "SET notificationStatus = :sent, notifiedAt = :now REMOVE sendingOwner",
          ExpressionAttributeValues: {
            ":sending": "sending",
            ":sent": "sent",
            ":owner": owner,
            ":now": new Date().toISOString(),
          },
        }),
      );
      return "updated";
    } catch (error) {
      if (isConditionalConflict(error)) return "lost";
      throw error;
    }
  },
  async markPending(idempotencyKey, owner, errorName, dueAt) {
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { idempotencyKey },
          ConditionExpression:
            "notificationStatus = :sending AND sendingOwner = :owner",
          UpdateExpression:
            "SET notificationStatus = :pending, notificationDueAt = :dueAt, lastNotificationError = :errorName REMOVE sendingOwner",
          ExpressionAttributeValues: {
            ":sending": "sending",
            ":pending": "pending",
            ":owner": owner,
            ":dueAt": dueAt,
            ":errorName": errorName.slice(0, 64),
          },
        }),
      );
      return "updated";
    } catch (error) {
      if (isConditionalConflict(error)) return "lost";
      throw error;
    }
  },
  async markFailed(idempotencyKey, owner, errorName) {
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { idempotencyKey },
          ConditionExpression:
            "notificationStatus = :sending AND sendingOwner = :owner",
          UpdateExpression:
            "SET notificationStatus = :failed, lastNotificationError = :errorName REMOVE sendingOwner",
          ExpressionAttributeValues: {
            ":sending": "sending",
            ":failed": "failed",
            ":owner": owner,
            ":errorName": errorName.slice(0, 64),
          },
        }),
      );
      return "updated";
    } catch (error) {
      if (isConditionalConflict(error)) return "lost";
      throw error;
    }
  },
  async listDue(status, dueBefore, limit) {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "notification-due",
        KeyConditionExpression:
          "notificationStatus = :status AND notificationDueAt <= :dueBefore",
        ExpressionAttributeValues: {
          ":status": status,
          ":dueBefore": dueBefore,
        },
        Limit: limit,
      }),
    );
    return (result.Items as LeadRecord[] | undefined) ?? [];
  },
};

let cachedSmtp: SmtpSettings | undefined;

function secretError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

function parseSmtpSecret(raw: string): SmtpSettings {
  const parsed = JSON.parse(raw) as {
    hostname?: unknown;
    port?: unknown;
    username?: unknown;
    password?: unknown;
  };
  const port = typeof parsed.port === "number" ? parsed.port : Number(parsed.port);
  if (
    typeof parsed.hostname !== "string" ||
    parsed.hostname.length === 0 ||
    port !== 465 ||
    typeof parsed.username !== "string" ||
    parsed.username.length === 0 ||
    typeof parsed.password !== "string" ||
    parsed.password.length === 0
  ) {
    throw secretError("SmtpSecretInvalid");
  }
  return {
    hostname: parsed.hostname,
    port,
    username: parsed.username,
    password: parsed.password,
  };
}

async function smtpSettings(): Promise<SmtpSettings> {
  if (cachedSmtp) return cachedSmtp;
  const result = await secrets.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  if (!result.SecretString) throw secretError("SmtpSecretMissing");
  cachedSmtp = parseSmtpSecret(result.SecretString);
  return cachedSmtp;
}

async function sendMail(lead: LeadRecord): Promise<void> {
  const settings = await smtpSettings();
  const transport = nodemailer.createTransport({
    host: settings.hostname,
    port: settings.port,
    secure: true,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transport.sendMail({
    from: smtpFrom,
    to: smtpTo,
    replyTo: lead.email,
    subject: enquirySubject(
      lead.enquiryType,
      process.env.NOTIFICATION_SUBJECT_PREFIX,
    ),
    text: enquiryText(lead),
  });
}

export async function handler(event: ContactHttpEvent) {
  return processEnquiry(event, { store, sendMail });
}

export async function retryHandler() {
  const summary = await retryDueNotifications({ store, sendMail });
  console.info(
    "Notification retry complete",
    JSON.stringify({
      processed: summary.processed,
      sent: summary.sent,
      pending: summary.pending,
      skipped: summary.skipped,
      failed: summary.failed,
    }),
  );
  return summary;
}
