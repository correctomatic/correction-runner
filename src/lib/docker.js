import Dockerode from 'dockerode'

import { generateContainerName } from './container_names.js'

export class NotInitializedError extends Error {}
export class ConnectionTimeoutError extends Error {}
export class ContainerCreationError extends Error {}
class TimeoutError extends Error {}

function envVars(parameters) { return Object.entries(parameters).map(([key, value]) => `${key}=${value}`) }

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
let logger = console

async function initializeDocker(dockerServer, logger = console) {
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

const EXERCISE_FILE_IN_CONTAINER = '/tmp/exercise'
function generateBind(exerciseFile) {
  return [`${exerciseFile}:${EXERCISE_FILE_IN_CONTAINER}`]
}

async function createCorrectionContainer(image, file){
  //******************************************* */
  // DEBUG: THIS IS FOR TESTING WITH correction-1 image
  const env = {
    DELAY: 20,
    ERROR_PROBABILITY: 0.09,
    RESPONSE_SIZE: 100
  }
  //*******************************************
  const connectionTimeout = 1000
  const binds = generateBind(file)

  const container = await createContainer(
    image, connectionTimeout, binds,env,
  )

  return container.id
}

export {
  initializeDocker,
  getDocker,
  createCorrectionContainer,
}
