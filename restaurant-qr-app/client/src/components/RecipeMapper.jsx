import React, { useState, useMemo, useRef, useEffect } from 'react';

export default function RecipeMapper({
  recipe = [],
  onUpdateRecipe,
  inventoryList = [],
  onSetMakingCost
}) {
  const [ingredientName, setIngredientName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const wrapperRef = useRef(null);
  const qtyInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart search: exact match first, then word-by-word fuzzy fallback (e.g. "tea power" -> "TEA POWDER")
  const filteredInventory = useMemo(() => {
    const list = inventoryList || [];
    const q = (ingredientName || '').trim().toLowerCase();
    if (!q) return list;

    // 1. Direct substring match
    const directMatches = list.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
    if (directMatches.length > 0) return directMatches;

    // 2. Word-by-word match (handles typos like "tea power" -> "TEA POWDER")
    const words = q.split(/\s+/).filter(Boolean);
    return list.filter((item) => {
      const name = item.name.toLowerCase();
      return words.some((w) => name.includes(w) || (w.length >= 3 && name.startsWith(w.slice(0, 3))));
    });
  }, [ingredientName, inventoryList]);

  // Find matching inventory item for selected name
  const matchedInv = useMemo(() => {
    if (!ingredientName) return null;
    return (inventoryList || []).find(
      (i) => i.name.toLowerCase() === ingredientName.trim().toLowerCase()
    );
  }, [ingredientName, inventoryList]);

  // Calculate total recipe cost
  const totalMakingCost = useMemo(() => {
    return (recipe || []).reduce((sum, ing) => {
      const inv = (inventoryList || []).find((i) => i.name === ing.name);
      const unitCost = Number(inv?.costPrice || inv?.cost || 0);
      return sum + Number(ing.quantity || 0) * unitCost;
    }, 0);
  }, [recipe, inventoryList]);

  // Select item from list
  const handleSelectItem = (item) => {
    setIngredientName(item.name);
    setIsDropdownOpen(false);
    // Auto-focus quantity input
    setTimeout(() => {
      if (qtyInputRef.current) qtyInputRef.current.focus();
    }, 50);
  };

  // Handle adding or updating ingredient
  const handleAdd = (e) => {
    if (e) e.preventDefault();
    const cleanName = ingredientName.trim();
    if (!cleanName) {
      alert('Please type or select an ingredient.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      if (qtyInputRef.current) qtyInputRef.current.focus();
      return;
    }

    const existingIdx = (recipe || []).findIndex(
      (r) => r.name.toLowerCase() === cleanName.toLowerCase()
    );

    let updated;
    if (existingIdx >= 0) {
      updated = [...recipe];
      updated[existingIdx] = { ...updated[existingIdx], quantity: numQty };
    } else {
      updated = [...(recipe || []), { name: cleanName, quantity: numQty }];
    }

    onUpdateRecipe(updated);
    setIngredientName('');
    setQuantity('');
    setIsDropdownOpen(false);
  };

  // Remove ingredient
  const handleRemove = (name) => {
    const updated = (recipe || []).filter((r) => r.name !== name);
    onUpdateRecipe(updated);
  };

  // Inline update quantity of existing ingredient
  const handleInlineQtyChange = (idx, newQty) => {
    const val = parseFloat(newQty);
    const updated = [...recipe];
    updated[idx] = { ...updated[idx], quantity: isNaN(val) ? '' : val };
    onUpdateRecipe(updated);
  };

  return (
    <div style={{ borderTop: '1px solid #432E22', paddingTop: '14px', marginTop: '14px', width: '100%', boxSizing: 'border-box' }}>
      <label style={{ color: 'var(--color-primary)', fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
        Recipe Mapping (Ingredients)
      </label>

      {/* Mapped Ingredients List */}
      {(!recipe || recipe.length === 0) ? (
        <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '4px 0 10px 0' }}>
          No ingredients mapped yet. This item will not deduct stock.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {recipe.map((ing, idx) => {
            const invItem = (inventoryList || []).find((i) => i.name === ing.name);
            return (
              <div
                key={ing.name || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--color-border)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ing.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <input
                    type="number"
                    value={ing.quantity}
                    min="0.001"
                    step="0.001"
                    onChange={(e) => handleInlineQtyChange(idx, e.target.value)}
                    style={{
                      width: '60px',
                      padding: '4px',
                      fontSize: '13px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      background: 'transparent',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '20px' }}>
                    {invItem?.unit || 'g'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(ing.name)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                    title="Remove"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ingredient Cost from Recipe Banner */}
      {recipe && recipe.length > 0 && totalMakingCost > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 107, 8, 0.08)', border: '1px dashed var(--color-primary)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
            Ingredient Cost from Recipe: <strong style={{ color: 'var(--color-primary)' }}>₹{totalMakingCost.toFixed(2)}</strong>
          </span>
          {onSetMakingCost && (
            <button
              type="button"
              onClick={() => onSetMakingCost(totalMakingCost.toFixed(2))}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', height: 'auto' }}
            >
              Use as Making Cost
            </button>
          )}
        </div>
      )}

      {/* Clean Add Ingredient Input Row with Custom Filtered Dropdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) auto', gap: '8px', alignItems: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
        <div ref={wrapperRef} style={{ position: 'relative', minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            Select / Search Ingredient
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Click or type to search..."
              value={ingredientName}
              onChange={(e) => {
                setIngredientName(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="form-input"
              style={{ width: '100%', padding: '8px 24px 8px 10px', fontSize: '13px', boxSizing: 'border-box' }}
            />
            {ingredientName && (
              <button
                type="button"
                onClick={() => {
                  setIngredientName('');
                  setIsDropdownOpen(true);
                }}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Interactive Dropdown List */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: '200px',
              overflowY: 'auto',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
              zIndex: 9999,
              padding: '4px 0'
            }}>
              {filteredInventory.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  No item matching "{ingredientName}". Check spelling or inventory.
                </div>
              ) : (
                filteredInventory.map((item) => {
                  const isSelected = matchedInv?.name === item.name;
                  return (
                    <div
                      key={item._id || item.name}
                      onClick={() => handleSelectItem(item)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--color-primary)' : '#1e293b',
                        background: isSelected ? 'rgba(255, 107, 8, 0.1)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{item.name}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ({item.unit || 'unit'})
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            Quantity {matchedInv ? `(${matchedInv.unit})` : ''}
          </label>
          <input
            ref={qtyInputRef}
            type="number"
            step="0.001"
            min="0.001"
            placeholder="e.g. 10"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="form-input"
            style={{ width: '100%', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '9px 14px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', height: '38px', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}
        >
          Map
        </button>
      </div>
    </div>
  );
}
