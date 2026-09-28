import { randomUUID, createHash } from 'crypto';
import { Readable } from 'stream';
import { File, Storage } from '@google-cloud/storage';

import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from './objectAcl';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // =========================================================
  // CLOUDINARY STORAGE
  // =========================================================

  private getCloudinaryConfig() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary storage is not configured. ' +
          'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and ' +
          'CLOUDINARY_API_SECRET are required.',
      );
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
    };
  }

  /**
   * Creates the upload target returned to the frontend.
   *
   * The frontend will continue uploading to our own API:
   * PUT /api/uploads/:id
   *
   * Our backend then sends the image to Cloudinary.
   */
  getCloudinaryUploadTarget(origin: string) {
    const { cloudName } = this.getCloudinaryConfig();

    const id = randomUUID();

    return {
      uploadURL: `${origin}/api/uploads/${id}`,

      // Cloudinary delivery URL saved by the application.
      objectPath:
        `https://res.cloudinary.com/${cloudName}` +
        `/image/upload/elan/${id}`,

      objectId: `elan/${id}`,
    };
  }

  /**
   * Upload image bytes to Cloudinary using a signed upload.
   */
  async uploadToCloudinary(
    objectId: string,
    body: Buffer,
    contentType: string,
  ) {
    const {
      cloudName,
      apiKey,
      apiSecret,
    } = this.getCloudinaryConfig();

    const timestamp = Math.floor(Date.now() / 1000);

    /*
     * Cloudinary signature:
     * public_id=<value>&timestamp=<value> + API_SECRET
     */
    const paramsToSign =
      `public_id=${objectId}&timestamp=${timestamp}`;

    const signature = createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const form = new FormData();

    /*
     * Convert the Node Buffer into a Uint8Array so it can safely
     * be passed to Blob/FormData.
     */
    const bytes = new Uint8Array(body);

    form.append(
      'file',
      new Blob(
        [bytes],
        {
          type: contentType || 'application/octet-stream',
        },
      ),
      'upload',
    );

    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('public_id', objectId);
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: form,
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);

      throw new Error(
        `Cloudinary upload failed (${response.status}): ${detail}`,
      );
    }

    return response.json();
  }

  // =========================================================
  // LEGACY REPLIT OBJECT STORAGE
  // Kept because other parts of the project may still use it.
  // =========================================================

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';

    const paths = Array.from(
      new Set(
        pathsStr
          .split(',')
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );

    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          'tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).',
      );
    }

    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';

    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }

    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();

      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(
    file: File,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();

    const aclPolicy = await getObjectAclPolicy(file);

    const isPublic = aclPolicy?.visibility === 'public';

    const nodeStream = file.createReadStream();

    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type':
        (metadata.contentType as string) ||
        'application/octet-stream',

      'Cache-Control':
        `${isPublic ? 'public' : 'private'}, max-age=${cacheTtlSec}`,
    };

    if (metadata.size) {
      headers['Content-Length'] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();

    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }

    const objectId = randomUUID();

    const fullPath =
      `${privateObjectDir}/uploads/${objectId}`;

    const {
      bucketName,
      objectName,
    } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(
    objectPath: string,
  ): Promise<File> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split('/');

    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join('/');

    let entityDir = this.getPrivateObjectDir();

    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }

    const objectEntityPath =
      `${entityDir}${entityId}`;

    const {
      bucketName,
      objectName,
    } = parseObjectPath(objectEntityPath);

    const bucket =
      objectStorageClient.bucket(bucketName);

    const objectFile =
      bucket.file(objectName);

    const [exists] =
      await objectFile.exists();

    if (!exists) {
      throw new ObjectNotFoundError();
    }

    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (
      !rawPath.startsWith(
        'https://storage.googleapis.com/',
      )
    ) {
      return rawPath;
    }

    const url = new URL(rawPath);

    const rawObjectPath = url.pathname;

    let objectEntityDir =
      this.getPrivateObjectDir();

    if (!objectEntityDir.endsWith('/')) {
      objectEntityDir =
        `${objectEntityDir}/`;
    }

    if (
      !rawObjectPath.startsWith(
        objectEntityDir,
      )
    ) {
      return rawObjectPath;
    }

    const entityId =
      rawObjectPath.slice(
        objectEntityDir.length,
      );

    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath =
      this.normalizeObjectEntityPath(rawPath);

    if (!normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    const objectFile =
      await this.getObjectEntityFile(
        normalizedPath,
      );

    await setObjectAclPolicy(
      objectFile,
      aclPolicy,
    );

    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission:
        requestedPermission ??
        ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const pathParts = path.split('/');

  if (pathParts.length < 3) {
    throw new Error(
      'Invalid path: must contain at least a bucket name',
    );
  }

  const bucketName = pathParts[1];

  const objectName =
    pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(
      Date.now() + ttlSec * 1000,
    ).toISOString(),
  };

  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(request),

      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`,
    );
  }

  const payload =
    (await response.json()) as {
      signed_url?: string;
    };

  const signedURL =
    payload.signed_url;

  if (!signedURL) {
    throw new Error(
      'Signed URL response did not include signed_url',
    );
  }

  return signedURL;
}
