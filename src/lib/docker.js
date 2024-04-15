
class ConnectionTimeoutError extends Error {}
class ContainerCreationError extends Error {}

function envVars(parameters) { return Object.entries(parameters).map(([key, value]) => `${key}=${value}`) }

// Credit: https://stackoverflow.com/questions/32461271/nodejs-timeout-a-promise-if-failed-to-complete-in-time
async function withTimeout(millis, promise) {
  let timeoutPid
  const timeout = new Promise((_resolve, reject) => {
        timeoutPid = setTimeout(
            () => reject(`Timed out after ${millis} ms.`),
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

async function createContainer(docker, image, connectionTimeout = DEFAULT_OPTIONS.connectionTimeout, binds = [], env = {}) {
  try {
    const container = await withTimeout(connectionTimeout, docker.createContainer({
      Image: image,
      // Name: 'node-app-container', // Optional
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


const dockerServer = null
const docker = new Docker(dockerServer)

async function createCorrectionContainer(image, file){
  const env = {
    DELAY: 20,
    ERROR_PROBABILITY: 0.09,
    RESPONSE_SIZE: 100
  }
  const connectionTimeout = 1000
  const binds = []

  const container = await createContainer(
    docker, image, connectionTimeout, binds,env,
  )

  return container.id
}

export {
  createCorrectionContainer,
}
