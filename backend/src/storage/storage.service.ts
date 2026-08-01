import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Thin wrapper around the S3-compatible object store (MinIO in dev). Objects
 * are never public: every read goes through a short-lived presigned URL, so
 * the bucket itself can stay private regardless of environment.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.S3_BUCKET as string;
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
  });

  // Presigned URLs embed the endpoint they're signed against. In Docker
  // Compose, S3_ENDPOINT is the container-network hostname ("minio"), which
  // the browser can never resolve — so signing must use a separately
  // configured, externally-reachable endpoint instead. Falls back to
  // S3_ENDPOINT when the two are the same (e.g. outside Docker).
  private readonly presignClient = new S3Client({
    endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
  });

  /**
   * Dev convenience only: MinIO starts with no buckets, so ensure the app's
   * bucket exists on boot. Never auto-provisions in production — a missing
   * bucket there is an infra misconfiguration that should surface as errors,
   * not be silently papered over by the app.
   */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created dev bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.warn(
          `Could not ensure storage bucket "${this.bucket}" exists: ${(err as Error).message}`,
        );
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  presignGet(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
