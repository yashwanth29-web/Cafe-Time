function realtimeSyncPlugin(schema) {
  // Helper to extract model name
  const getModelName = (context, doc) => {
    if (doc && doc.constructor && doc.constructor.modelName) {
      return doc.constructor.modelName;
    }
    if (context && context.model && context.model.modelName) {
      return context.model.modelName;
    }
    return null;
  };

  // Helper to emit real-time event to owner rooms
  const emitUpdate = (context, doc, operation) => {
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      
      const modelName = getModelName(context, doc);
      if (!modelName) return;

      const cafeId = (doc && doc.cafeId) || 'CD001';
      const branchId = (doc && (doc.branchId || doc.assignedBranch)) || 'all';

      const payload = {
        model: modelName,
        operation,
        cafeId,
        branchId,
        id: doc && doc._id ? String(doc._id) : undefined
      };

      // Emit to cafe-specific owner rooms
      io.to(`cafe:${cafeId}:owner`).emit('dashboard_realtime_update', payload);
      io.to(`cafe_${cafeId}_owner`).emit('dashboard_realtime_update', payload);
      io.to(`cafe:${cafeId}:owner`).emit('dashboard_realtime_sync', payload);
      io.to(`cafe_${cafeId}_owner`).emit('dashboard_realtime_sync', payload);

      // Model-specific triggers
      if (modelName === 'Order') {
        io.to(`cafe:${cafeId}:owner`).emit('order_updated', doc);
        io.to(`cafe_${cafeId}_owner`).emit('order_updated', doc);
      } else if (modelName === 'Inventory' || modelName === 'InventoryLog') {
        io.to(`cafe:${cafeId}:owner`).emit('inventory_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('inventory_updated', payload);
      } else if (modelName === 'User') {
        io.to(`cafe:${cafeId}:owner`).emit('staff_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('staff_updated', payload);
      } else if (modelName === 'Attendance') {
        io.to(`cafe:${cafeId}:owner`).emit('attendance_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('attendance_updated', payload);
      } else if (modelName === 'Payroll') {
        io.to(`cafe:${cafeId}:owner`).emit('payroll_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('payroll_updated', payload);
      } else if (modelName === 'Review') {
        io.to(`cafe:${cafeId}:owner`).emit('reviews_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('reviews_updated', payload);
      } else if (modelName === 'Category' || modelName === 'MenuItem') {
        io.to(`cafe:${cafeId}:owner`).emit('menu_updated', payload);
        io.to(`cafe_${cafeId}_owner`).emit('menu_updated', payload);
      }
    } catch (err) {
      // Socket might not be initialized during server startup/seeding, safe to ignore
    }
  };

  // 1. Post Save hook (handles document creation and saving)
  schema.post('save', function(doc) {
    emitUpdate(this, doc, 'save');
  });

  // 2. Post Remove/Delete hooks (document level)
  schema.post('remove', function(doc) {
    emitUpdate(this, doc, 'remove');
  });
  schema.post('deleteOne', { document: true, query: false }, function(doc) {
    emitUpdate(this, doc, 'remove');
  });

  // 3. Post hooks for Query-level mutations
  schema.post('updateOne', function() {
    const query = this.getQuery();
    emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'update_query');
  });

  schema.post('updateMany', function() {
    const query = this.getQuery();
    emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'update_query');
  });

  schema.post('findOneAndUpdate', function(doc) {
    if (doc) {
      emitUpdate(this, doc, 'save');
    } else {
      const query = this.getQuery();
      emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'update_query');
    }
  });

  schema.post('deleteOne', { document: false, query: true }, function() {
    const query = this.getQuery();
    emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'remove_query');
  });

  schema.post('deleteMany', function() {
    const query = this.getQuery();
    emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'remove_query');
  });

  schema.post('findOneAndDelete', function(doc) {
    if (doc) {
      emitUpdate(this, doc, 'remove');
    } else {
      const query = this.getQuery();
      emitUpdate(this, { cafeId: query.cafeId, branchId: query.branchId }, 'remove_query');
    }
  });
}

module.exports = realtimeSyncPlugin;
