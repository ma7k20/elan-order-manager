import { Readable } from 'stream';

import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';

import {
  raw,
  Router,
  type IRouter,
  type Request,
  type Response,
} from 'express';

import { ObjectPermission } from '../lib/objectAcl';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

import { requireAuth } from '../middlewares/requireAuth';

const router: IRouter = Router();

const objectStorageService =
  new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Generates our internal upload URL.
 *
 * The frontend uploads the image to our API,
 * then our API sends it to Cloudinary.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth,

  async (
    req: Request,
    res: Response,
  ) => {
    const parsed =
      RequestUploadUrlBody.safeParse(
        req.body,
      );

    if (!parsed.success) {
      res.status(400).json({
        error:
          'Missing or invalid required fields',
      });

      return;
    }

    try {
      const {
        name,
        size,
        contentType,
      } = parsed.data;

      const forwardedProto =
        req
          .get('x-forwarded-proto')
          ?.split(',')[0]
          .trim();

      const origin =
        `${forwardedProto || req.protocol}` +
        `://${req.get('host')}`;

      const target =
        objectStorageService
          .getCloudinaryUploadTarget(
            origin,
          );

      const objectId =
        target.objectId
          .split('/')
          .pop();

      if (!objectId) {
        res.status(500).json({
          error:
            'Failed to create upload target',
        });

        return;
      }

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL:
            target.uploadURL,

          objectPath:
            target.objectPath,

          metadata: {
            name,
            size,
            contentType,
          },
        }),
      );
    } catch (error) {
      req.log.error(
        { err: error },
        'Error generating Cloudinary upload URL',
      );

      res.status(500).json({
        error:
          'Failed to generate upload URL',
      });
    }
  },
);

/**
 * PUT /uploads/:id
 *
 * Receives the image from the frontend
 * and uploads it to Cloudinary.
 */
router.put(
  '/uploads/:id',

  raw({
    type: [
      'application/octet-stream',
      'image/*',
      'application/pdf',
    ],
    limit: '10mb',
  }),

  async (
    req: Request<{ id: string }>,
    res: Response,
  ) => {
    try {
      req.log.info(
        {
          uploadId:
            req.params.id,
        },
        'Cloudinary upload handler reached',
      );

      const body =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from([]);

      if (!body.length) {
        res.status(400).json({
          error: 'Empty upload',
        });

        return;
      }

      await objectStorageService
        .uploadToCloudinary(
          `elan/${req.params.id}`,
          body,
          req.headers[
            'content-type'
          ] ||
            'application/octet-stream',
        );

      res.sendStatus(204);
    } catch (error) {
      req.log.error(
        { err: error },
        'Error uploading object to Cloudinary',
      );

      res.status(500).json({
        error:
          'Failed to upload file',
      });
    }
  },
);

/**
 * Legacy public object route.
 *
 * Kept so other existing parts of the
 * application are not broken.
 */
router.get(
  '/storage/public-objects/*filePath',

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const rawPath =
        req.params.filePath;

      const filePath =
        Array.isArray(rawPath)
          ? rawPath.join('/')
          : rawPath;

      const file =
        await objectStorageService
          .searchPublicObject(
            filePath,
          );

      if (!file) {
        res.status(404).json({
          error:
            'File not found',
        });

        return;
      }

      const response =
        await objectStorageService
          .downloadObject(file);

      res.status(response.status);

      response.headers.forEach(
        (value, key) =>
          res.setHeader(
            key,
            value,
          ),
      );

      if (response.body) {
        const nodeStream =
          Readable.fromWeb(
            response.body as ReadableStream<Uint8Array>,
          );

        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error(
        { err: error },
        'Error serving public object',
      );

      res.status(500).json({
        error:
          'Failed to serve public object',
      });
    }
  },
);

/**
 * Legacy private object route.
 */
router.get(
  '/storage/objects/*path',
  requireAuth,

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const rawPath =
        req.params.path;

      const wildcardPath =
        Array.isArray(rawPath)
          ? rawPath.join('/')
          : rawPath;

      const objectPath =
        `/objects/${wildcardPath}`;

      const objectFile =
        await objectStorageService
          .getObjectEntityFile(
            objectPath,
          );

      /*
       * Protected route example:
       *
       * const canAccess =
       *   await objectStorageService
       *     .canAccessObjectEntity({
       *       userId: req.user.id,
       *       objectFile,
       *       requestedPermission:
       *         ObjectPermission.READ,
       *     });
       */

      const response =
        await objectStorageService
          .downloadObject(
            objectFile,
          );

      res.status(
        response.status,
      );

      response.headers.forEach(
        (value, key) =>
          res.setHeader(
            key,
            value,
          ),
      );

      if (response.body) {
        const nodeStream =
          Readable.fromWeb(
            response.body as ReadableStream<Uint8Array>,
          );

        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (
        error instanceof
        ObjectNotFoundError
      ) {
        req.log.warn(
          { err: error },
          'Object not found',
        );

        res.status(404).json({
          error:
            'Object not found',
        });

        return;
      }

      req.log.error(
        { err: error },
        'Error serving object',
      );

      res.status(500).json({
        error:
          'Failed to serve object',
      });
    }
  },
);

export default router;
