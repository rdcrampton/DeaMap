/**
 * Shared S3 Client Singleton + Legacy Upload Helper
 *
 * All S3 interactions (including the DDD S3ImageStorageAdapter)
 * should import getS3Client() from this module to avoid creating
 * multiple S3Client instances.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { buildS3Url } from "./s3-utils";

let _s3Client: S3Client | null = null;

/**
 * Returns the shared S3Client singleton.
 * Lazily initialized on first call.
 */
export function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.AWS_REGION || "eu-west-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _s3Client;
}

/** Returns the configured S3 bucket name, throwing if not set. */
export function getS3BucketName(): string {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("AWS_S3_BUCKET_NAME is not configured");
  }
  return bucketName;
}

/** Returns the configured AWS region. */
export function getS3Region(): string {
  return process.env.AWS_REGION || "eu-west-1";
}

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  prefix?: string;
}

/**
 * Legacy upload helper (used by older code paths).
 * New code should prefer the S3ImageStorageAdapter via DDD ports.
 */
export async function uploadToS3({
  buffer,
  filename,
  contentType,
  prefix = "dea-foto",
}: UploadOptions): Promise<string> {
  const bucketName = getS3BucketName();
  const region = getS3Region();

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${prefix}/${timestamp}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  });

  await getS3Client().send(command);

  return buildS3Url(bucketName, region, key);
}
