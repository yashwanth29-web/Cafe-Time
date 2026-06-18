const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

/**
 * Syncs a local multer file to GridFS
 * @param {Object} file - Multer file object
 */
const syncToGridFS = async (file) => {
  if (!file) return null;
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.db) {
      console.warn('MongoDB connection not active, skipping GridFS sync.');
      return null;
    }

    const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
    
    // Check if file already exists in GridFS to prevent duplicates
    const existing = await bucket.find({ filename: file.filename }).toArray();
    if (existing && existing.length > 0) {
      console.log(`File ${file.filename} already exists in GridFS.`);
      return existing[0];
    }

    const writeStream = bucket.openUploadStream(file.filename, {
      contentType: file.mimetype || 'image/jpeg'
    });

    const readStream = fs.createReadStream(file.path);
    
    return new Promise((resolve, reject) => {
      readStream.pipe(writeStream)
        .on('finish', (gfsFile) => {
          console.log(`Successfully synced ${file.filename} to GridFS.`);
          resolve(gfsFile || { _id: writeStream.id, filename: file.filename });
        })
        .on('error', (err) => {
          console.error(`Error piping file ${file.filename} to GridFS:`, err);
          reject(err);
        });
    });
  } catch (error) {
    console.error(`GridFS sync error for ${file.filename}:`, error);
    return null;
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
  serveFromGridFS
};
