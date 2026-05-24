// Handle relational invariants — errors that depend on relationships BETWEEN fields.
// Shape fixes handle individual field types; relational fixes handle field dependencies.

function fixReadFileInvariants(input) {
  const notes = [];
  const fixed = { ...input };

  const DEFAULT_READ_LIMIT = 2000;

  // If offset present but no limit → set default limit
  if (fixed.offset !== undefined && fixed.limit === undefined) {
    fixed.limit = DEFAULT_READ_LIMIT; // Match common Read tool default
    notes.push('limit defaulted to 2000 lines (offset was specified without limit). To read more/fewer lines, specify both offset and limit.');
  }

  // If limit present but no offset → set offset to 0
  if (fixed.limit !== undefined && fixed.offset === undefined) {
    fixed.offset = 0;
    notes.push('offset defaulted to 0 (limit was specified without offset). To start from a different position, specify both offset and limit.');
  }

  return {
    repaired: notes.length > 0,
    input: fixed,
    notes,
    fix: 'relational-invariant',
  };
}

// Map of tool-specific relational fixers
const relationalFixers = {
  read_file: fixReadFileInvariants,
  Read: fixReadFileInvariants,
};

function applyRelationalFixes(toolName, input) {
  const fixer = relationalFixers[toolName];
  if (!fixer) return { repaired: false, input };
  return fixer(input);
}

module.exports = { applyRelationalFixes, fixReadFileInvariants };
