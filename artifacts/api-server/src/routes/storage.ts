import { Readable } from 'stream';
import { randomUUID } from 'node:crypto';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { raw, Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import { requireAuth } from '../middlewares/requireAuth';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const pendingUploads = new Map<string, number>();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0].trim();
      const origin = `${forwardedProto || req.protocol}://${req.get('host')}`;
      const target = objectStorageService.getSupabaseUploadTarget(origin);
      const objectId = target.objectId.split('/').pop();
      if (!objectId) {
        res.status(500).json({ error: 'Failed to create upload target' });
        return;
      }
      const uploadToken = randomUUID();
      pendingUploads.set(`${objectId}:${uploadToken}`, Date.now() + 15 * 60 * 1000);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL: `${target.uploadURL}?token=${uploadToken}`,
          objectPath: target.objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

router.put(
  '/storage/uploads/:id',
  raw({ type: ['application/octet-stream', 'image/*', 'application/pdf'], limit: '10mb' }),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const uploadKey = `${req.params.id}:${token}`;
      const expiresAt = pendingUploads.get(uploadKey);
      if (!expiresAt || expiresAt < Date.now()) {
        pendingUploads.delete(uploadKey);
        res.sendStatus(401);
        return;
      }
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!body.length) {
        res.status(400).json({ error: 'Empty upload' });
        return;
      }
      await objectStorageService.uploadToSupabase(
        `uploads/${req.params.id}`,
        body,
        req.headers['content-type'] || 'application/octet-stream',
      );
      pendingUploads.delete(uploadKey);
      res.sendStatus(204);
    } catch (error) {
      req.log.error({ err: error }, 'Error uploading object to Supabase');
      res.status(500).json({ error: 'Failed to upload file' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
