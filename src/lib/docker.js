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

function generateBind(exerciseFile) {
  return [`${exerciseFile}:${EXERCISE_FILE_IN_CONTAINER}`]
}

function extractRegistryURL(imageName) {
  const parts = imageName.split('/');

  // The registry name is usually the first part and contains a dot (.) or a colon (:)
  if (parts.length > 1 && (parts[0].includes('.') || parts[0].includes(':'))) {
      return parts[0];
  }

  return '';
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

async function initializeDockerode(dockerServer, logger = console) {
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
    super()
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
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  })
}

function getRepositoryCredentials(image) {
  const registryURL = extractRegistryURL(image)

  return env.docker.DOCKER_REGISTRY_CREDENTIALS[registryURL] || {}
}

// New function to ensure the image is pulled if not available
async function ensureImagePulled(image, logger = defaultLogger) {
  try {
    const images = await getDocker().listImages({ filters: { reference: [image] } })

    if (images.length === 0) {
      logger.info(`Image ${image} not found locally. Pulling...`)

      const registryCredentials = getRepositoryCredentials(image)
      if (registryCredentials) logger.debug(`Using registry credentials: ${JSON.stringify(registryCredentials)}`)

      await new Promise((resolve, reject) => {
        // Dockerode pull resolves before the image is actually pulled
        // We need to use the onFinished callback to know when it's done
        getDocker().pull(image, { authconfig: registryCredentials }, (err, stream) => {
          function onFinished(err) {
            if (err) return reject(err)
            logger.info(`Image ${image} pulled successfully.`)
            resolve()
          }

          function onProgress(event) {
            logger.debug(event)
          }

          if (err) return reject(err)
          getDocker().modem.followProgress(stream, onFinished, onProgress)
        })
      })

    } else {
      logger.info(`Image ${image} already exists locally.`)
    }
  } catch (e) {
    logger.error(`Failed to ensure image ${image} is pulled: ${e.message}`)
    throw e
  }
}

// Most of the complexity is in the optional parameters
async function createContainer(image,options = {},logger = defaultLogger) {

  const defaultOptions = {
    binds: [],
    environment: [],
    connectionTimeout: env.docker.DOCKER_TIMEOUT,
    pullTimeout: env.docker.DOCKER_PULL_TIMEOUT
  }
  options = { ...defaultOptions, ...options }

  try {
    if(options.pull) await withTimeout(options.pullTimeout, ensureImagePulled(image, logger))

    const container = await withTimeout(options.connectionTimeout, getDocker().createContainer({
      Image: image,
      name: generateContainerName(),
      Env: options.environment,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        // AutoRemove: true,
        AutoRemove: false,
        Binds: options.binds
      },
      // For testing errors starting the container. This will fail on start
      // Entrypoint: ['/your/entrypoint'], // Specify the entrypoint
    }))
    return container
  } catch (e) {
    throw new ContainerCreationError(e.message || e)
  }
}

async function createCorrectionContainer(image, file, params=[], logger = defaultLogger){
  const connectionTimeout = env.docker.DOCKER_TIMEOUT
  const pullTimeout = env.docker.DOCKER_PULL_TIMEOUT
  const pull = env.docker.DOCKER_PULL

  const binds = generateBind(file)
  logger.debug(`Creating container with image ${image} and binds ${binds}`)

  const createOptions = {
    binds,
    // Docker expects environment variables as an array of strings in the form 'KEY=VALUE' (https://github.com/apocas/dockerode/issues/130)
    // That's the format that we have in the job data
    environment: params,
    pull,
    connectionTimeout,
    pullTimeout,
  }
  const container = await createContainer(
    image, createOptions, logger
  )

  return container
}

async function launchCorrectionContainer(image, file, params=[], logger = defaultLogger) {
  const container = await createCorrectionContainer(image, file, params)
  try {
    // The next conditional is for helping with testing
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
  initializeDockerode,
  getDocker,
  launchCorrectionContainer,
  getContainerLogs
}
