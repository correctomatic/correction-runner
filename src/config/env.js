import dotenv from 'dotenv'
dotenv.config()

const DEFAULT_ENVIRONMENT = 'production'

const DEFAULT_LOG_LEVEL = 'info'
const DEFAULT_LOG_FILE = 'correctomatic.log'

const RMQ_HOST = process.env.RABBITMQ_HOST
const RMQ_USER = process.env.RABBITMQ_USER
const RMQ_PASSWORD = process.env.RABBITMQ_PASSWORD

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

  // TODO: REMOVE
  rabbit: {
    RABBITMQ_URL: `amqp://${RMQ_USER}:${RMQ_PASSWORD}@${RMQ_HOST}`,
  },

  docker: {
    DOCKER_SERVER: process.env.DOCKER_SERVER,
    DONT_START_CONTAINER: process.env.DONT_START_CONTAINER == 'S',
  },
}
