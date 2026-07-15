const Table = require('../models/Table');
const OperationalConfig = require('../models/OperationalConfig');
const Branch = require('../models/Branch');

/**
 * Parses and normalizes table input (e.g. 'Table-4', 'T4', '4' -> '4')
 */
const parseTableNumber = (rawTable) => {
  if (rawTable === undefined || rawTable === null) return '';
  const str = String(rawTable).trim();
  // Strip common prefixes like 'table-', 'table ', 'table', 't'
  return str.replace(/^(table[- ]?|t)/i, '');
};

/**
 * Resolves a table for a given branch and cafe.
 * If the table does not exist, it self-heals by generating it.
 */
const resolveAndSelfHealTable = async (cafeId, branchId, rawTable) => {
  console.log(`[TABLE LOOKUP] Resolving table: "${rawTable}" for cafe: "${cafeId}", branch: "${branchId}"`);

  if (!cafeId || !branchId || !rawTable) {
    console.warn(`[TABLE LOOKUP WARNING] Missing parameters: cafeId=${cafeId}, branchId=${branchId}, rawTable=${rawTable}`);
    return null;
  }

  const cleanTable = String(rawTable).trim();
  if (cleanTable.toLowerCase() === 'takeaway' || cleanTable.toLowerCase() === 'walk-in') {
    return {
      tableId: cleanTable,
      tableNumber: cleanTable,
      branchId,
      cafeId,
      status: 'Active'
    };
  }

  const parsedNum = parseTableNumber(cleanTable);
  if (!parsedNum) {
    console.warn(`[TABLE LOOKUP WARNING] Parsed table number is empty for raw input: "${rawTable}"`);
    return null;
  }

  // 1. Try finding in Table collection
  let tableDoc = await Table.findOne({
    cafeId,
    branchId,
    $or: [
      { tableNumber: parsedNum },
      { tableId: parsedNum },
      { tableId: `T${parsedNum}` },
      { tableId: cleanTable }
    ]
  });

  if (tableDoc) {
    console.log(`[TABLE LOOKUP SUCCESS] Table resolved from database: id=${tableDoc.tableId}, number=${tableDoc.tableNumber}`);
    return tableDoc;
  }

  // 2. Self-heal: If table does not exist, create it.
  console.log(`[TABLE SELF-HEAL] Table not found. Repairing and auto-generating table: "${parsedNum}"`);

  // Verify branch exists first
  const branch = await Branch.findOne({ branchId, cafeId });
  if (!branch) {
    console.error(`[TABLE SELF-HEAL ERROR] Branch "${branchId}" does not exist for cafe "${cafeId}". Cannot self-heal table.`);
    return null;
  }

  const tableId = `T${parsedNum}`;
  const tableNumber = parsedNum;

  try {
    // Attempt to create table document
    tableDoc = await Table.findOneAndUpdate(
      { cafeId, branchId, tableNumber },
      { tableId, tableNumber, branchId, cafeId, status: 'Active' },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    console.log(`[TABLE SELF-HEAL SUCCESS] Auto-created Table document: ${tableId}`);
  } catch (err) {
    console.error(`[TABLE SELF-HEAL ERROR] Failed to upsert Table document:`, err);
    // Fetch if it was created concurrently
    tableDoc = await Table.findOne({ cafeId, branchId, tableNumber });
    if (!tableDoc) return null;
  }

  // 3. Keep OperationalConfig tables array in sync
  try {
    let opConfig = await OperationalConfig.findOne({ cafeId, branchId });
    if (!opConfig) {
      opConfig = await OperationalConfig.create({
        cafeId,
        branchId,
        tables: [{ id: tableId, label: `Table-${tableNumber}` }],
        printerEnabled: false,
        kitchenDisplayEnabled: true,
        inventoryEnabled: true
      });
      console.log(`[TABLE SELF-HEAL] Created missing OperationalConfig for branch: ${branchId}`);
    } else {
      const exists = opConfig.tables.some(t => 
        String(t.id).toLowerCase() === tableId.toLowerCase() ||
        String(t.id).toLowerCase() === tableNumber.toLowerCase() ||
        String(t.label).toLowerCase() === `table-${tableNumber}`.toLowerCase()
      );
      if (!exists) {
        opConfig.tables.push({ id: tableId, label: `Table-${tableNumber}` });
        await opConfig.save();
        console.log(`[TABLE SELF-HEAL] Pushed table ${tableId} to OperationalConfig tables list.`);
      }
    }
  } catch (err) {
    console.error(`[TABLE SELF-HEAL ERROR] Failed to update OperationalConfig tables:`, err);
  }

  return tableDoc;
};

/**
 * Audit all branches/cafes, repair missing references, populate Table collection,
 * and remove any duplicates or corrupt data.
 */
const auditAndRepairAllTables = async () => {
  console.log('[TABLE AUDIT] Starting database audit and repair...');
  try {
    const branches = await Branch.find({});
    console.log(`[TABLE AUDIT] Found ${branches.length} branches to audit.`);

    for (const branch of branches) {
      const { cafeId, branchId } = branch;
      let opConfig = await OperationalConfig.findOne({ cafeId, branchId });
      
      // If OperationalConfig does not exist, create it with default tables
      if (!opConfig) {
        console.log(`[TABLE AUDIT] OperationalConfig missing for branch: ${branchId}. Creating...`);
        opConfig = await OperationalConfig.create({
          cafeId,
          branchId,
          tables: [
            { id: 'T1', label: 'Table-1' },
            { id: 'T2', label: 'Table-2' },
            { id: 'T3', label: 'Table-3' },
            { id: 'T4', label: 'Table-4' },
            { id: 'T5', label: 'Table-5' }
          ],
          printerEnabled: false,
          kitchenDisplayEnabled: true,
          inventoryEnabled: true
        });
      }

      // Ensure every table in OperationalConfig is synced into the Table collection
      const tablesList = opConfig.tables || [];
      if (tablesList.length === 0) {
        // Populate default tables if empty
        tablesList.push(
          { id: 'T1', label: 'Table-1' },
          { id: 'T2', label: 'Table-2' },
          { id: 'T3', label: 'Table-3' },
          { id: 'T4', label: 'Table-4' },
          { id: 'T5', label: 'Table-5' }
        );
        opConfig.tables = tablesList;
        await opConfig.save();
      }

      for (const t of tablesList) {
        const rawId = t.id || '';
        const rawLabel = t.label || '';
        const parsedNum = parseTableNumber(rawId) || parseTableNumber(rawLabel);
        
        if (!parsedNum) continue;

        const tableId = `T${parsedNum}`;
        const tableNumber = parsedNum;

        // Upsert table document to ensure exact matching
        await Table.findOneAndUpdate(
          { cafeId, branchId, tableNumber },
          { tableId, tableNumber, branchId, cafeId, status: 'Active' },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // Sync Table collection back to OperationalConfig to clean up any legacy corrupted entries (like cafeId CD001 mismatch)
      const allBranchTables = await Table.find({ cafeId, branchId });
      const syncedTables = allBranchTables.map(tb => ({
        id: tb.tableId,
        label: `Table-${tb.tableNumber}`
      }));

      // Update OperationalConfig tables to match the Table collection perfectly
      await OperationalConfig.updateOne(
        { cafeId, branchId },
        { $set: { tables: syncedTables } }
      );
    }

    // Clean up orphan Table documents that do not belong to any active branch
    const allTables = await Table.find({});
    for (const t of allTables) {
      const branchExists = branches.some(b => b.branchId === t.branchId && b.cafeId === t.cafeId);
      if (!branchExists) {
        console.log(`[TABLE AUDIT] Deleting orphan Table: ${t.tableId} from branch: ${t.branchId}, cafe: ${t.cafeId}`);
        await Table.deleteOne({ _id: t._id });
      }
    }

    console.log('[TABLE AUDIT SUCCESS] Database audit and repair completed successfully.');
  } catch (error) {
    console.error('[TABLE AUDIT ERROR] Failed during table audit and repair:', error);
  }
};

module.exports = {
  parseTableNumber,
  resolveAndSelfHealTable,
  auditAndRepairAllTables
};
