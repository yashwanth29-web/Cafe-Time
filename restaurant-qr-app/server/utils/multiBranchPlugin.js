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
        required: true,
        default: 'CD001'
      }
    });
  }
  if (!schema.paths.branchId) {
    schema.add({
      branchId: {
        type: String,
        required: true,
        default: 'default'
      }
    });
  }

  // Ensure index on { cafeId, branchId }
  schema.index({ cafeId: 1, branchId: 1 });

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
      if (!query.branchId) {
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

  // 2. Pre-save hook to ensure documents are saved with active branch context
  schema.pre('save', function(next) {
    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      this.cafeId = context.cafeId;
      this.branchId = context.branchId;
    }
    if (typeof next === 'function') {
      next();
    }
  });

  schema.pre('validate', function(next) {
    const context = getContext();
    if (context && context.cafeId && context.branchId) {
      this.cafeId = context.cafeId;
      this.branchId = context.branchId;
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
      // Inject $match at the very beginning of the pipeline
      pipeline.unshift({
        $match: {
          cafeId: context.cafeId,
          branchId: context.branchId
        }
      });
    }
    if (typeof next === 'function') {
      next();
    }
  });
};
