import pino from 'pino'
import env from '../config/env.js'

const environment = env.ENVIRONMENT
const logLevel = env.log.LOG_LEVEL
const logFile = env.log.LOG_FILE

let targets = []
if (environment === 'development') {
  targets = [
    {
      level: logLevel,
      target: 'pino-pretty',
      options: {},
    },
  ]
} else {
  targets = [
    {
      level: logLevel,
      target: 'pino/file',
      options: {
        destination: logFile,
      },
    },
  ]
}

const transport = pino.transport({
  targets
})

const logger = pino({
  level: logLevel,
}, transport)


function clearSensitiveFields(object, extraFields = ['password', 'token']) {
  const SENSITIVE_FIELDS = ['password', 'REDIS_PASSWORD']
  const fields = [...SENSITIVE_FIELDS, ...extraFields]

  // Use JSON.stringify with a replacer function to exclude sensitive fields
  const jsonString = JSON.stringify(object, (key, value) => {
    if (fields.includes(key)) {
      return '********'
    } else {
      return value
    }
  })

  // Use JSON.parse to parse the modified JSON string back into an object
  const parsedObject = JSON.parse(jsonString)

  return parsedObject
}


export default logger
export {
  clearSensitiveFields,
}
