// Tool schema registry. '!' suffix = required field.
// 'path' = file path string (gets autolink detection + traversal check).

const toolSchemas = {
  read_file: {
    file_path: 'path!',
    offset: 'number',
    limit: 'number',
  },
  write_to_file: {
    file_path: 'path!',
    content: 'string!',
  },
  edit_file: {
    file_path: 'path!',
    old_string: 'string!',
    new_string: 'string!',
    replace_all: 'boolean',
  },
  search_content: {
    directory: 'path!',
    pattern: 'string!',
    file_types: 'string',
    output_mode: 'string',
  },
  execute_command: {
    command: 'string!',
    args: 'array',
    requires_approval: 'boolean',
  },
  list_files: {
    target_directory: 'path!',
    depth: 'number',
    offset: 'number',
    limit: 'number',
  },
  Read: {
    file_path: 'path!',
    offset: 'number',
    limit: 'number',
  },
  // Claude Code tool surface (top-5 by call frequency).
  // Added in v1.1 after shadow-bench data confirmed these as the next-most-failing tools.
  Bash: {
    command: 'string!',
    description: 'string',
    timeout: 'number',
    run_in_background: 'boolean',
  },
  Glob: {
    pattern: 'string!',
    path: 'path',
  },
  Grep: {
    pattern: 'string!',
    path: 'path',
    glob: 'string',
    type: 'string',
    output_mode: 'string',
    '-i': 'boolean',
    '-n': 'boolean',
    '-A': 'number',
    '-B': 'number',
    '-C': 'number',
    head_limit: 'number',
    multiline: 'boolean',
  },
  TodoWrite: {
    todos: 'array!',
  },
  WebFetch: {
    url: 'string!',
    prompt: 'string!',
  },
};

function getSchema(toolName) {
  return toolSchemas[toolName] || null;
}

module.exports = { toolSchemas, getSchema };
