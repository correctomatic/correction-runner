import Ajv from 'ajv'
import {
  CONTAINER_RESPONSE_SCHEMA
} from '../src/schemas/index.js'

const options = {
  allErrors: false,
  verbose: false
}

const schema = CONTAINER_RESPONSE_SCHEMA
const ajv = new Ajv(options)
const validate = ajv.compile(schema)
const validateSucceeded = ajv.compile(schema.definitions.succeededCorrectionSchema)
const validateFailed = ajv.compile(schema.definitions.failedCorrectionSchema)


let data

data = {
  success: true,
  grade: 10,
  comments: [ 'Good job', 'Well done' ]
}

if(!validateSucceeded(data)) {
  console.log(validateSucceeded.errors)
} else {
  console.log('Data is valid')
}
if(!validate(data)) {
  console.log(validate.errors)
} else {
  console.log('Data is valid')
}

data = {
  success: false,
  error: 'Error message'
  // grade: 10,
  // comments: [ 'Good job', 'Well done' ]
}


if(!validateFailed(data)) {
  console.log(validateFailed.errors)
} else {
  console.log('Data is valid')
}
if(!validate(data)) {
  console.log(validate.errors)
} else {
  console.log('Data is valid')
}
