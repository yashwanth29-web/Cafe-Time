const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

/**
/**
 * Syncs a local multer file or file path to GridFS
 * @param {Object|string} fileOrPath - Multer file object or absolute file path
 * @param {string} [explicitFilename] - Optional filename override
 * @param {string} [explicitMimeType] - Optional mime type override
 */
const syncToGridFS = async (fileOrPath, explicitFilename = null, explicitMimeType = null) => {
  if (!fileOrPath) return null;
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.db) {
      console.warn('MongoDB connection not active, skipping GridFS sync.');
      return null;
    }

    let filePath, filename, mimetype;
    if (typeof fileOrPath === 'string') {
      filePath = fileOrPath;
      filename = explicitFilename || path.basename(fileOrPath);
      const ext = path.extname(filename).toLowerCase();
      mimetype = explicitMimeType || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
    } else if (fileOrPath && typeof fileOrPath === 'object') {
      filePath = fileOrPath.path;
      filename = fileOrPath.filename || explicitFilename || path.basename(fileOrPath.path || '');
      mimetype = fileOrPath.mimetype || explicitMimeType || 'image/jpeg';
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[GridFS Sync] File does not exist on disk: ${filePath}`);
      return null;
    }

    const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    
    // Check if file already exists in GridFS to prevent duplicates
    const existing = await bucket.find({ filename }).toArray();
    if (existing && existing.length > 0) {
      return existing[0];
    }

    const writeStream = bucket.openUploadStream(filename, {
      contentType: mimetype
    });

    const readStream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      readStream.pipe(writeStream)
        .on('finish', (gfsFile) => {
          console.log(`Successfully synced ${filename} to GridFS.`);
          resolve(gfsFile || { _id: writeStream.id, filename });
        })
        .on('error', (err) => {
          console.error(`Error piping file ${filename} to GridFS:`, err);
          reject(err);
        });
    });
  } catch (error) {
    console.error(`GridFS sync error for ${explicitFilename || fileOrPath}:`, error);
    return null;
  }
};

/**
 * Syncs all local files in public/uploads to GridFS if missing
 */
const syncAllUploadsToGridFS = async () => {
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.db) return;

    const uploadsDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadsDir)) return;

    const files = fs.readdirSync(uploadsDir);
    if (!files || files.length === 0) return;

    const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    const existing = await bucket.find({}).toArray();
    const existingSet = new Set(existing.map(f => f.filename));

    let syncedCount = 0;
    for (const filename of files) {
      if (!existingSet.has(filename)) {
        const fullPath = path.join(uploadsDir, filename);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            const ext = path.extname(filename).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
            await syncToGridFS(fullPath, filename, mime);
            syncedCount++;
          }
        } catch (e) {
          // ignore single file stat errors
        }
      }
    }
    if (syncedCount > 0) {
      console.log(`[GridFS Auto-Sync] Successfully synced ${syncedCount} missing local uploads to MongoDB GridFS.`);
    }
  } catch (err) {
    console.error('[GridFS Auto-Sync Error]', err.message);
  }
};

/**
 * Serves a file from GridFS with a fallback to the local filesystem
 * @param {string} filename - Name of the file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const serveFromGridFS = async (filename, req, res) => {
  const localFallback = path.join(__dirname, '../public/uploads', filename);
  const defaultPlaceholder = path.join(__dirname, '../public/images/default-food.png');

  const sendPlaceholderOr404 = () => {
    if (fs.existsSync(defaultPlaceholder)) {
      return res.sendFile(defaultPlaceholder);
    }
    return res.status(404).send('Not found');
  };

  try {
    const conn = mongoose.connection;
    if (!conn || !conn.db) {
      // Fallback to local file if DB connection is not ready
      if (fs.existsSync(localFallback)) {
        return res.sendFile(localFallback);
      }
      return sendPlaceholderOr404();
    }

    const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    
    const files = await bucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      // Fallback to local filesystem if not in GridFS
      if (fs.existsSync(localFallback)) {
        return res.sendFile(localFallback);
      }
      return sendPlaceholderOr404();
    }

    const file = files[0];
    const etag = file.md5 || file._id.toString();

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.set('ETag', etag);

    // Support conditional GET (304 Not Modified)
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.set('Content-Type', file.contentType || 'image/jpeg');
    
    const downloadStream = bucket.openDownloadStreamByName(filename);
    downloadStream.pipe(res)
      .on('error', (err) => {
        console.error(`Error streaming file ${filename} from GridFS:`, err);
        if (fs.existsSync(localFallback)) {
          return res.sendFile(localFallback);
        }
        if (!res.headersSent) {
          sendPlaceholderOr404();
        }
      });
  } catch (error) {
    console.error(`Error retrieving ${filename} from GridFS:`, error);
    if (fs.existsSync(localFallback)) {
      return res.sendFile(localFallback);
    }
    if (!res.headersSent) {
      sendPlaceholderOr404();
    }
  }
};

module.exports = {
  syncToGridFS,
  syncAllUploadsToGridFS,
  serveFromGridFS
};
