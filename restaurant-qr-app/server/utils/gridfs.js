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
// In-memory cache for ultra-fast serving (< 1ms) without disk or DB overhead
const imageMemoryCache = new Map(); // filename -> { buffer, contentType, etag, size }
const MAX_MEMORY_CACHE_BYTES = 50 * 1024 * 1024; // 50MB limit
let currentMemoryCacheBytes = 0;

const putInMemoryCache = (filename, buffer, contentType, etag) => {
  if (!buffer || buffer.length > 5 * 1024 * 1024) return; // Don't cache single files > 5MB in RAM
  
  // Evict oldest entries if capacity exceeded
  while (currentMemoryCacheBytes + buffer.length > MAX_MEMORY_CACHE_BYTES && imageMemoryCache.size > 0) {
    const oldestKey = imageMemoryCache.keys().next().value;
    const item = imageMemoryCache.get(oldestKey);
    currentMemoryCacheBytes -= item.size;
    imageMemoryCache.delete(oldestKey);
  }

  imageMemoryCache.set(filename, { buffer, contentType, etag, size: buffer.length });
  currentMemoryCacheBytes += buffer.length;
};

/**
 * Serves a file from GridFS with high-performance local disk and memory fast-paths
 * @param {string} filename - Name of the file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const serveFromGridFS = async (filename, req, res) => {
  const localFallback = path.join(__dirname, '../public/uploads', filename);
  const defaultPlaceholder = path.join(__dirname, '../public/images/default-food.png');

  const sendPlaceholderOr404 = () => {
    if (fs.existsSync(defaultPlaceholder)) {
      res.set({
        'Cache-Control': 'public, max-age=86400',
        'Content-Type': 'image/png'
      });
      return res.sendFile(defaultPlaceholder);
    }
    return res.status(404).send('Not found');
  };

  // FAST-PATH 1: In-memory cache hit (< 0.5ms)
  const memCached = imageMemoryCache.get(filename);
  if (memCached) {
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': memCached.etag,
      'Content-Type': memCached.contentType
    });
    if (req.headers['if-none-match'] === memCached.etag) {
      return res.status(304).end();
    }
    return res.end(memCached.buffer);
  }

  // FAST-PATH 2: Local disk file exists (< 2ms)
  if (fs.existsSync(localFallback)) {
    try {
      const stat = fs.statSync(localFallback);
      const etag = `"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`;
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';

      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Content-Type': mime
      });

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      // Populate memory cache asynchronously for subsequent ultra-fast requests
      if (stat.size <= 3 * 1024 * 1024) {
        fs.readFile(localFallback, (err, data) => {
          if (!err && data) {
            putInMemoryCache(filename, data, mime, etag);
          }
        });
      }

      return res.sendFile(localFallback, {
        maxAge: '365d',
        immutable: true,
        lastModified: true,
        etag: true
      });
    } catch (diskErr) {
      console.warn(`[GridFS disk read fallback] ${diskErr.message}`);
    }
  }

  // FAST-PATH 3: GridFS Persistent Storage Stream + Auto-cache to disk & memory
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.db) {
      return sendPlaceholderOr404();
    }

    const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    const files = await bucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return sendPlaceholderOr404();
    }

    const file = files[0];
    const etag = file.md5 ? `"${file.md5}"` : `"${file._id.toString()}"`;
    const contentType = file.contentType || 'image/jpeg';

    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': etag,
      'Content-Type': contentType
    });

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // Ensure uploads directory exists on disk to persist the downloaded file
    const uploadsDir = path.dirname(localFallback);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const downloadStream = bucket.openDownloadStreamByName(filename);
    const diskWriteStream = fs.createWriteStream(localFallback);
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        putInMemoryCache(filename, fullBuffer, contentType, etag);
      } catch (e) {
        // ignore buffer concat errors
      }
    });

    downloadStream.on('error', (err) => {
      console.error(`Error streaming file ${filename} from GridFS:`, err.message);
      try {
        if (fs.existsSync(localFallback)) fs.unlinkSync(localFallback);
      } catch (_) {}
      if (!res.headersSent) {
        sendPlaceholderOr404();
      }
    });

    // Pipe download stream to disk for persistent disk caching
    downloadStream.pipe(diskWriteStream);
    // Pipe download stream to client response
    downloadStream.pipe(res);

  } catch (error) {
    console.error(`Error retrieving ${filename} from GridFS:`, error.message);
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

