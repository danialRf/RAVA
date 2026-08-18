/**
 * Private object storage.
 *
 * docs/SECURITY_COMPLIANCE.md §7: customer uploads (request images, later
 * receipts) must be private by default, size/type limited upstream, served
 * through generated object names, never executable. The provider interface
 * keeps MinIO swappable for any S3-compatible service.
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface StoredObject {
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

/** Rejects renamed or spoofed uploads before they enter private storage. */
export function matchesImageSignature(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  if (contentType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      bytes.length >= png.length &&
      png.every((value, index) => bytes[index] === value)
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export interface PrivateStorage {
  readonly id: string;
  /** Stores bytes under a caller-generated key; never makes them public. */
  putPrivate(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<StoredObject>;
  /** Reads bytes back for staff-side inspection only. */
  getPrivate(
    objectKey: string,
  ): Promise<{ body: Uint8Array; contentType: string } | null>;
}

export class PrivateStorageError extends Error {
  constructor(providerId: string, reason: string) {
    super(`Private storage ${providerId} failed: ${reason}`);
    this.name = "PrivateStorageError";
  }
}

/** S3/MinIO-backed implementation for local development and production. */
export class S3PrivateStorage implements PrivateStorage {
  readonly id: string;
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(input: {
    readonly endpoint: string;
    readonly region: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly id?: string;
  }) {
    this.id = input.id ?? "s3";
    this.#bucket = input.bucket;
    this.#client = new S3Client({
      endpoint: input.endpoint,
      region: input.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: input.accessKeyId,
        secretAccessKey: input.secretAccessKey,
      },
    });
  }

  async putPrivate(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        // Private by default; nothing publishes these objects.
        ACL: "private",
      }),
    );
    return {
      objectKey,
      contentType,
      sizeBytes: body.byteLength,
    };
  }

  async getPrivate(
    objectKey: string,
  ): Promise<{ body: Uint8Array; contentType: string } | null> {
    try {
      const response = await this.#client.send(
        new GetObjectCommand({ Bucket: this.#bucket, Key: objectKey }),
      );
      if (response.Body === undefined) return null;
      const bytes = await response.Body.transformToByteArray();
      return {
        body: bytes,
        contentType: response.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey") return null;
      throw error;
    }
  }
}

/** In-memory implementation for tests and offline development. */
export class InMemoryPrivateStorage implements PrivateStorage {
  readonly id = "memory";
  readonly #objects = new Map<
    string,
    { body: Uint8Array; contentType: string }
  >();

  async putPrivate(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    this.#objects.set(objectKey, { body, contentType });
    return { objectKey, contentType, sizeBytes: body.byteLength };
  }

  async getPrivate(
    objectKey: string,
  ): Promise<{ body: Uint8Array; contentType: string } | null> {
    return this.#objects.get(objectKey) ?? null;
  }
}

export interface StorageProviderConfiguration {
  readonly STORAGE_PROVIDER: "minio" | "s3" | "fake";
  readonly S3_ENDPOINT: string;
  readonly S3_REGION: string;
  readonly S3_BUCKET_PRIVATE: string;
  readonly S3_ACCESS_KEY: string;
  readonly S3_SECRET_KEY: string;
}

export function createPrivateStorage(
  configuration: StorageProviderConfiguration,
): PrivateStorage {
  switch (configuration.STORAGE_PROVIDER) {
    case "minio":
    case "s3":
      return new S3PrivateStorage({
        endpoint: configuration.S3_ENDPOINT,
        region: configuration.S3_REGION,
        bucket: configuration.S3_BUCKET_PRIVATE,
        accessKeyId: configuration.S3_ACCESS_KEY,
        secretAccessKey: configuration.S3_SECRET_KEY,
        id: configuration.STORAGE_PROVIDER,
      });
    case "fake":
      return new InMemoryPrivateStorage();
  }
}
