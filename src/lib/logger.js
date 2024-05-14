import pino from 'pino'
import env from './env.js'

const environment =env.ENVIRONMENT
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
},transport)

export default logger
