import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getMinioConfig() {
  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  const useSsl = process.env.MINIO_USE_SSL === "true";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("缺少 MinIO 配置，请设置 MINIO_ENDPOINT、MINIO_BUCKET、MINIO_ACCESS_KEY、MINIO_SECRET_KEY。");
  }

  return {
    bucket,
    client: new S3Client({
      region: "us-east-1",
      endpoint: `${useSsl ? "https" : "http"}://${endpoint}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

export async function uploadToMinio(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const { client, bucket } = getMinioConfig();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );

  return {
    bucket,
    key: params.key,
  };
}

export async function downloadFromMinio(key: string) {
  const { client, bucket } = getMinioConfig();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const bytes = await response.Body?.transformToByteArray();

  if (!bytes) {
    throw new Error(`无法从 MinIO 读取文件：${key}`);
  }

  return {
    bucket,
    key,
    body: Buffer.from(bytes),
    contentType: response.ContentType ?? "application/octet-stream",
  };
}
