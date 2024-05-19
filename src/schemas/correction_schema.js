
const SUCCEEDED_CORRECTION_SCHEMA ={
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Succeeded Correction Schema",
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "enum": [true]
    },
    "grade": {
      "type": "number"
    },
    "comments": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "success"
  ],
  "anyOf": [
    { "required": ["grade"] },
    { "required": ["comments"] }
  ]
}

const FAILED_CORRECTION_SCHEMA ={
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Failed Correction Schema",
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "enum": [false]
    },
    "error": {
      "type": "string"
    }
  },
  "required": [
    "success",
    "error"
  ]
}

const CORRECTION_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Correction Schema",
  "oneOf": [
    SUCCEEDED_CORRECTION_SCHEMA,
    FAILED_CORRECTION_SCHEMA
  ]
}

export {
  CORRECTION_SCHEMA,
  SUCCEEDED_CORRECTION_SCHEMA,
  FAILED_CORRECTION_SCHEMA
}

