import dotenv from 'dotenv'
dotenv.config()

import { readFile, mergeDeep } from '../lib/config.js'

const DEFAULT_ENVIRONMENT = 'production'

const DEFAULT_LOG_LEVEL = 'info'
const DEFAULT_LOG_FILE = 'correctomatic.log'


const DEFAULT_DONT_START_CONTAINER='N'
const DEFAULT_DOCKER_TIMEOUT = 5000
const DEFAULT_DOCKER_OPTIONS = '{"socketPath": "/var/run/docker.sock"}'
const DEFAULT_DOCKER_PULL='N'
const DEFAULT_DOCKER_PULL_TIMEOUT = 15000
const DEFAULT_DOCKER_REGISTRY_CREDENTIALS = {}

const DEFAULT_CONCURRENT_NOTIFIERS = 50

// eslint-disable-next-line complexity
function stringToBoolean(stringValue){
  switch(stringValue?.toLowerCase()?.trim()){
      case "true":
      case "yes":
      case "1":
      case "y":
        return true

      case "false":
      case "no":
      case "0":
      case "n":
      case "":
      case null:
      case undefined:
        return false

      default:
        return false
  }
}


function dockerOptions() {
  // Env var has precedence over file
  if(process.env.DOCKER_OPTIONS) return process.env.DOCKER_OPTIONS || DEFAULT_DOCKER_OPTIONS
  if(process.env.DOCKER_OPTIONS_FILE) return readFile(process.env.DOCKER_OPTIONS_FILE)

  return DEFAULT_DOCKER_OPTIONS
}

function repositoryCredentials() {
  let fileCredentials = {}
  if(process.env.DOCKER_REGISTRY_CREDENTIALS_FILE){
    fileCredentials = readFile(process.env.DOCKER_REGISTRY_CREDENTIALS_FILE)
  }
  const envCredentials = process.env.DOCKER_REGISTRY_CREDENTIALS || DEFAULT_DOCKER_REGISTRY_CREDENTIALS
  return mergeDeep(fileCredentials, envCredentials)
}

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
    DOCKER_OPTIONS: dockerOptions(),
    DOCKER_PULL: stringToBoolean(process.env.DOCKER_PULL || DEFAULT_DOCKER_PULL),
    DOCKER_PULL_TIMEOUT: Number(process.env.DOCKER_PULL_TIMEOUT || DEFAULT_DOCKER_PULL_TIMEOUT),
    DOCKER_REGISTRY_CREDENTIALS: repositoryCredentials(),
    DONT_START_CONTAINER: stringToBoolean(process.env.DONT_START_CONTAINER || DEFAULT_DONT_START_CONTAINER),
  },

  bullmq: {
    CONCURRENT_NOTIFIERS: Number(process.env.CONCURRENT_NOTIFIERS || DEFAULT_CONCURRENT_NOTIFIERS)
  },
}
