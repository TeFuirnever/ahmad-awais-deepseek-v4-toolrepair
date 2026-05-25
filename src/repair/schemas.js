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
};

function getSchema(toolName) {
  return toolSchemas[toolName] || null;
}

module.exports = { toolSchemas, getSchema };
