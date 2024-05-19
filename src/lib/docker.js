import Dockerode from 'dockerode'
import { Writable } from 'stream'
import env from '../config/env.js'
import defaultLogger from './logger.js'

import { generateContainerName } from './container_names.js'

export class NotInitializedError extends Error {}
export class ConnectionTimeoutError extends Error {}
export class ContainerCreationError extends Error {}
export class ContainerStartError extends Error {}
class TimeoutError extends Error {}

// **************************************************************************
// This is the path where the exercise file will be mounted in the container
// It's part of the specification, so DON'T CHANGE IT unless you change
// the major version of the correction system
// **************************************************************************
const EXERCISE_FILE_IN_CONTAINER = '/tmp/exercise'

const DEFAULT_OPTIONS = {
  connectionTimeout: 2000
}

function envVars(parameters) { return Object.entries(parameters).map(([key, value]) => `${key}=${value}`) }
function generateBind(exerciseFile) {
  return [`${exerciseFile}:${EXERCISE_FILE_IN_CONTAINER}`]
}

// Credit: https://stackoverflow.com/questions/32461271/nodejs-timeout-a-promise-if-failed-to-complete-in-time
async function withTimeout(millis, promise) {
  let timeoutPid
  const timeout = new Promise((_resolve, reject) => {
        timeoutPid = setTimeout(
            () => reject(new TimeoutError(`Timed out after ${millis} ms.`)),
            millis)
      })
  try {
    return await Promise.race([
      promise,
      timeout
    ])
  } finally {
    if (timeoutPid) {
      clearTimeout(timeoutPid)
    }
  }
}

let docker = null

async function initializeDocker(dockerServer, logger = console) {
  if(docker) return // Already initialized
  try {
    docker = new Dockerode(dockerServer)
    logger.info('Docker initialized')
  } catch(e) {
    logger.error(e.message)
    if(e instanceof TimeoutError) {
      throw new ConnectionTimeoutError(e.message)
    }
    throw e
  }
}

function getDocker() {
  if(!docker) throw new Error('Docker not initialized')
  return docker
}

class MemoryWritableStream extends Writable {
  constructor() {
    super();
    this.buffer = ''
  }

  content() {
    return this.buffer
  }

  _write(chunk, _encoding, callback) {
    this.buffer += chunk.toString()
    callback()
  }
}

// This function is used to get the logs from a container
// The logs are multiplexed, so we need to separate them
// IMPORTANT: we are returning the standard output and then the standard error, concatenated
async function getContainerLogs(container) {
  return new Promise((resolve, reject) => {
    container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      const stdout = new MemoryWritableStream()
      const stderr = new MemoryWritableStream()
      container.modem.demuxStream(stream, stdout, stderr)

      stream.on('end', async () => {
        resolve(stdout.content() + stderr.content())
      });

      stream.on('error', (err) => {
        reject(err)
      });
    });
  });
}

async function createContainer(image, connectionTimeout = DEFAULT_OPTIONS.connectionTimeout, binds = [], env = {}) {
  try {
    const container = await withTimeout(connectionTimeout, getDocker().createContainer({
      Image: image,
      name: generateContainerName(),
      Env: envVars(env),
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        // AutoRemove: true,
        AutoRemove: false,
        Binds: binds
      },
      // For testing errors starting the container. This will fail on start
      // Entrypoint: ['/your/entrypoint'], // Specify the entrypoint
    }))
    return container
  } catch (e) {
    throw new ContainerCreationError(e.message || e)
  }
}

async function createCorrectionContainer(image, file, logger = defaultLogger){
  const connectionTimeout = DEFAULT_OPTIONS.connectionTimeout
  const binds = generateBind(file)
  logger.debug(`Creating container with image ${image} and binds ${binds}`)

  const container = await createContainer(
    image, connectionTimeout, binds
  )

  return container
}

async function launchCorrectionContainer(image, file, logger = defaultLogger) {
  const container = await createCorrectionContainer(image, file)
  try {
    // TESTING: I'M STARTING CONTAINERS BY HAND
    if(env.docker.DONT_START_CONTAINER) return container.id
    logger.debug(`Starting container with id ${container.id}`)
    await container.start()
    return container.id
  } catch (e) {
    logger.error(e, `Container with id ${container.id} failed to start`)
    throw new ContainerStartError(e.message)
  }

}

export {
  initializeDocker,
  getDocker,
  launchCorrectionContainer,
  getContainerLogs
}
