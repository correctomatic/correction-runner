import dotenv from 'dotenv'
dotenv.config()

const DEFAULT_ENVIRONMENT = 'production'

const DEFAULT_LOG_LEVEL = 'info'
const DEFAULT_LOG_FILE = 'correctomatic.log'

const DEFAULT_DOCKER_TIMEOUT = 5000
const DEFAULT_DOCKER_OPTIONS = '{"socketPath": "/var/run/docker.sock"}'

const DEFAULT_CONCURRENT_NOTIFIERS = 50

export default {
  ENVIRONMENT: process.env.NODE_ENV || DEFAULT_ENVIRONMENT,

  log: {
    LOG_LEVEL: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
    LOG_FILE: process.env.LOG_FILE || DEFAULT_LOG_FILE,
  },

  redis: {
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  },

  docker: {
    DOCKER_TIMEOUT: Number(process.env.DOCKER_TIMEOUT || DEFAULT_DOCKER_TIMEOUT),
    DOCKER_OPTIONS: process.env.DOCKER_OPTIONS || DEFAULT_DOCKER_OPTIONS,
    DONT_START_CONTAINER: process.env.DONT_START_CONTAINER == 'S',
  },

  bullmq: {
    CONCURRENT_NOTIFIERS: Number(process.env.CONCURRENT_NOTIFIERS || DEFAULT_CONCURRENT_NOTIFIERS)
  },
}
