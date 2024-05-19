import Ajv from 'ajv'
import {
  // SUCCEEDED_CORRECTION_SCHEMA,
  // FAILED_CORRECTION_SCHEMA,
  CORRECTION_SCHEMA
} from '../src/schemas/correction_schema.js'

const options = {
  allErrors: false,
  verbose: true
}

const ajv = new Ajv(options)

const schema = CORRECTION_SCHEMA

const tests = [
// {
//   success: true,
//   grade: 10,
//   comments: [ 'Good job', 'Well done' ]
// },
{
  success: false,
  error: 'Error message'
  // grade: 10,
  // comments: [ 'Good job', 'Well done' ]
}
]

for (const data of tests) {
  const valid = ajv.validate(schema, data)
  if (!valid) {
    console.log(ajv.errors)
  } else {
    console.log('Data is valid')
  }
}

