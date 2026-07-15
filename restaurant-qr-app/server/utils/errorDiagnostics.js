const logErrorDiagnostics = (err, req, controllerName = 'UnknownController', serviceName = 'DatabaseService') => {
  const timestamp = new Date().toISOString();
  const authenticatedUser = req.user ? {
    _id: req.user._id,
    email: req.user.email,
    role: req.user.role
  } : 'Anonymous';

  const ownerId = req.user && (req.user.role === 'owner' || req.user.role === 'admin') ? req.user._id : (req.user ? req.user.cafeId : 'N/A');
  const cafeId = req.cafeId || (req.user && req.user.cafeId) || 'N/A';
  const branchId = req.branchId || 'N/A';
  const resourceId = req.params?.id || req.body?.id || req.body?._id || 'N/A';
  const httpMethod = req.method;
  const payload = { ...req.body };

  // Mask sensitive data in logs
  if (payload.password) payload.password = '***';
  if (payload.token) payload.token = '***';

  // Extract Mongo / Validation Errors
  let validationErrors = null;
  let mongoErrors = null;

  if (err.name === 'ValidationError') {
    validationErrors = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
  }

  if (err.code || err.writeErrors) {
    mongoErrors = {
      code: err.code,
      errmsg: err.errmsg,
      writeErrors: err.writeErrors
    };
  }

  console.error(`\n=== BACKEND DIAGNOSTIC ERROR LOG ===`);
  console.error(`Timestamp:          ${timestamp}`);
  console.error(`Controller Name:    ${err.controllerName || controllerName}`);
  console.error(`Service Name:       ${err.serviceName || serviceName}`);
  console.error(`HTTP Method:        ${httpMethod}`);
  console.error(`Request Path:       ${req.originalUrl}`);
  console.error(`Authenticated User: ${JSON.stringify(authenticatedUser)}`);
  console.error(`Owner ID:           ${ownerId}`);
  console.error(`Cafe ID:            ${cafeId}`);
  console.error(`Branch ID:          ${branchId}`);
  console.error(`Resource ID:        ${resourceId}`);
  console.error(`Payload:            ${JSON.stringify(payload)}`);
  if (validationErrors) {
    console.error(`Validation Errors:  ${JSON.stringify(validationErrors)}`);
  }
  if (mongoErrors) {
    console.error(`Mongo Errors:       ${JSON.stringify(mongoErrors)}`);
  }
  console.error(`Stack Trace:\n${err.stack || err}`);
  console.error(`=====================================\n`);
};

module.exports = { logErrorDiagnostics };
