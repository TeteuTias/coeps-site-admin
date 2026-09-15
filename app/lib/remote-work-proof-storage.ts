import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "node:stream"

function r2Client() {
    const endpoint = process.env.r2_endpoint_url
    const accessKeyId = process.env.r2_access_key
    const secretAccessKey = process.env.r2_secret_key
    const bucket = process.env.r2_bucket_name
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error("REMOTE_PROOF_STORAGE_NOT_CONFIGURED")
    }
    return {
        bucket,
        client: new S3Client({
            endpoint,
            region: "auto",
            credentials: { accessKeyId, secretAccessKey },
        }),
    }
}

export async function getRemoteWorkProofStream(objectKey: string): Promise<Readable> {
    const { client, bucket } = r2Client()
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
    if (!response.Body) throw new Error("REMOTE_PROOF_BODY_NOT_FOUND")
    return response.Body as Readable
}
