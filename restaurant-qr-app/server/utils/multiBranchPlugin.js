const { getContext } = require('./context');

module.exports = function multiBranchPlugin(schema) {
  // If explicitly configured to bypass branch filter, do nothing
  if (schema.options.bypassBranchFilter) {
    return;
  }

  // 1. Add fields to schema if not present
  if (!schema.paths.cafeId) {
    schema.add({
      cafeId: {
        type: String,
        required: true
      }
    });
  }
  if (!schema.paths.branchId) {
    schema.add({
      branchId: {
        type: String,
        required: true
      }
    });
  }

  // We do NOT add a global { cafeId: 1, branchId: 1 } index here because 
  // many individual schemas define their own specific compound indexes 
  // (sometimes with unique: true), which causes Mongoose duplicate index warnings.

  // Helper to apply branch filters to query
  const applyBranchFilter = function() {
    // If query options explicitly say to bypass, do not apply filter
    if (this.getOptions().bypassBranchFilter === true) {
      return;
    }

    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      const query = this.getQuery();
      
      if (!query.cafeId) {
        this.where({ cafeId: context.cafeId });
      }
      if (!query.branchId && context.branchId !== 'all') {
        this.where({ branchId: context.branchId });
      }
    }
  };

  // Register query middleware hooks
  const queryMethods = [
    'find', 'findOne', 'count', 'countDocuments',
    'updateOne', 'updateMany', 'findOneAndUpdate',
    'findOneAndDelete', 'deleteOne', 'deleteMany',
    'findOneAndRemove', 'remove', 'replaceOne'
  ];
  
  queryMethods.forEach(method => {
    schema.pre(method, applyBranchFilter);
  });

  // 2. Pre-save hook to ensure documents are saved with active branch context.
  // Only applies context values as defaults when the document doesn't already
  // have explicitly set values. This prevents the middleware context from
  // overwriting controller-level assignments (critical for QR order creation
  // where the controller resolves the correct branchId from the QR code).
  schema.pre('save', function(next) {
    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      // Only set cafeId/branchId from context if not explicitly provided
      // by the controller (i.e., the field was not modified on the document).
      if (!this.isModified('cafeId') && !this.cafeId) {
        this.cafeId = context.cafeId;
      }
      if (!this.isModified('branchId') && !this.branchId && context.branchId !== 'all') {
        this.branchId = context.branchId;
      }
    }
    if (typeof next === 'function') {
      next();
    }
  });

  schema.pre('validate', function(next) {
    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      if (!this.isModified('cafeId') && !this.cafeId) {
        this.cafeId = context.cafeId;
      }
      if (!this.isModified('branchId') && !this.branchId && context.branchId !== 'all') {
        this.branchId = context.branchId;
      }
    }
    if (typeof next === 'function') {
      next();
    }
  });

  // 3. Aggregate middleware
  schema.pre('aggregate', function(next) {
    // Check if this aggregation has bypass option set
    if (this.options && this.options.bypassBranchFilter === true) {
      if (typeof next === 'function') {
        next();
      }
      return;
    }

    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      const pipeline = this.pipeline();
      const matchStage = { cafeId: context.cafeId };
      if (context.branchId !== 'all') {
        matchStage.branchId = context.branchId;
      }
      // Inject $match at the very beginning of the pipeline
      pipeline.unshift({
        $match: matchStage
      });
    }
    if (typeof next === 'function') {
      next();
    }
  });
};
