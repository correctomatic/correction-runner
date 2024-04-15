import Docker from 'dockerode'

import {
  LimitedPassthroughStream,
  StreamSizeExceededError,
  streamToString
} from './lib/stream_utils.js'

const DEFAULT_OPTIONS = {
  dockerServer: null,     // Default to local Docker server
  connectionTimeout: 3,   // In seconds
  maxRuntime: 10,         // In seconds
  maxResponseSize: 1024,  // In bytes. Per channel (stdout, stderr) You can have maxResponseSize in stdout and maxResponseSize in stderr
  logger: console
}

/*
This library provides a function that creates a runner for Docker containers.

The runner function takes an image name and a set of environment variables,
runs the container with the given image and environment variables, and returns the output of the container.

You can use the function like this:
```js
const options = {
  dockerServer: {host: 'http://192.168.1.10', port: 3000},
  timeoutSeconds: 10,
}
const env = {
  ENV_VAR_1: 'value1',
  ENV_VAR_2: 'value2'
}
const runner = await createRunner(options)
const bindMounts = ['/tmp/exercise098F.zip:/tmp/exercise.zip']
const res = await runner(image('correction-test-1'), env, bindMounts)
```

bindMounts parameter is an optional parameter that allows you to bind-mount files to the container.
WARNING: It creates the folder in the host if the folder/file doesn't exist

You can pass an optional logger to the runner function. If you don't pass a logger, it will default
to the logger specified in the options object (console by default). It is useful if you want to pass a child
logger with additional context to the runner function, for example, to include a request ID:
```
const childLogger = logger.child({ requestId: '' });
```


The options object for createRunner can have the following optional properties.
If a property is not provided, it will default to the value in DEFAULT_OPTIONS:

- dockerServer:
  A string with the connection string to the Docker server. If not provided, it will default to the local Docker server.
  Examples of connection strings:
    - dockerServer: {socketPath: '/var/run/docker.sock'}
    - dockerServer: {host: 'http://192.168.1.10', port: 3000}
    - dockerServer: {protocol:'http', host: '127.0.0.1', port: 3000}
    - dockerServer: {host: '127.0.0.1', port: 3000})
  You can see more examples, including how to work with TLS, in the Dockerode documentation: https://github.com/apocas/dockerode

- connectionTimeout:
  A number with the maximum time in seconds that the function should wait for the Docker server to respond.
  If the server takes longer than this time, the function should throw a ConnectionTimeoutError.

- maxRuntime:
  A number with the maximum time in seconds that the container can run.
  If the container takes longer than this time, the function should throw a ContainerTimeoutError.

- maxResponseSize:
  A number with the maximum size in bytes that the response can have.
  If the response is larger than this size, the function should throw a ResponseTooLargeError.

- logger: a logger object that implements the methods `debug', `info`, `warn` and `error`. Defaults to console

The module also exports the following errors that the runner can throw:
- ConnectionTimeoutError
- ContainerCreationError
- ContainerStartError
- ContainerTimeoutError
- ContainerExecutionError
- ResponseTooLargeError

And a function to create the image name: image(name, [tag])
*/

const TO_MILLISECONDS = 1000

class ConnectionTimeoutError extends Error {}
class ContainerCreationError extends Error {}
class ContainerStartError extends Error {}
class ContainerTimeoutError extends Error {}
class ContainerExecutionError extends Error {}
class ResponseTooLargeError extends  Error {}

function image(name, tag) { return `${name}:${tag ?? 'latest'}` }
function envVars(parameters) { return Object.entries(parameters).map(([key, value]) => `${key}=${value}`) }
function rstrip(s) { return s.replace(/\s+$/, '') }

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

async function createContainer(docker, image, connectionTimeout = DEFAULT_OPTIONS.connectionTimeout, env = {}, binds = []) {
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
        AutoRemove: true,
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

// import { CORRECTOR_RESPONSE_SCHEMA } from './schemas/correction_schemas.js'

// // https://json-schema.org/blog/posts/get-started-with-json-schema-in-node-js
// function validateResponse(){
//   // TO-DO
// }



async function runContainer(container, maxRuntime, maxResponseSize, logger) {
  logger.debug(`Starting container id:${container.id}`)

  const stdout = new LimitedPassthroughStream({limit: maxResponseSize})
  const stderr = new LimitedPassthroughStream({limit: maxResponseSize})

  // Need to catch the error. An exception will be thrown if the limit is exceeded
  stdout.on('error', () => {})
  stderr.on('error', () => {})

  container.attach({stream: true, stdout: true, stderr: true}, function (err, stream) {
    container.modem.demuxStream(stream, stdout, stderr)
    // Demuxed streams are not automatically closed when the container is stopped
    stream.on('end', function() {
      stdout.end()
      stderr.end()
    })
  })

  try {
    await container.start() //starts the container
  } catch (e) {
    logger.error(e, `Container with id ${container.id} failed to start`)
    throw new ContainerStartError(e.message)
  }

  let containerResponse = null
  try {
    containerResponse = await withTimeout(maxRuntime, container.wait())
  } catch(e) {
    logger.error(`Container with id ${container.id} timed out`)
    await container.kill()
    throw new ContainerTimeoutError(`Container timed out`)
  }

  let containerOutput = null
  try {
    containerOutput = rstrip(await streamToString(stdout)) + rstrip(await streamToString(stderr))
  } catch (e) {
    if (e instanceof StreamSizeExceededError) {
      logger.error(`Container with id ${container.id} response size limit exceeded`)
      throw new ResponseTooLargeError('Response size limit exceeded')
    }
    logger.error(e)
    throw e
  }

  const finishedOK = containerResponse.StatusCode === 0
  if(!finishedOK) {
    logger.error(`Container with id ${container.id} finished with error code ${containerResponse.StatusCode}`)
    logger.debug(`Container output: ${containerOutput}`)
    throw new ContainerExecutionError(`Container with image ${image} finished with error code ${containerResponse.StatusCode}`)
  }

  // TO-DO: validate response format with ajv

  logger.info(`Container with id ${container.id} finished with output ${containerOutput}`)
  return containerOutput
}

export default async function createRunner(options = {}) {
  options = {...DEFAULT_OPTIONS, ...options}

  const {logger , ...loggedOptions} = options
  logger.info(`Creating Docker client with options ${JSON.stringify(loggedOptions)}`)

  const docker = new Docker(options.dockerServer)

  return async function(image, env, bindMounts=[], logger = options.logger) {

    logger.debug(`Creating container with image ${image} and env ${JSON.stringify(env)}`)
    const container = await createContainer(
      docker, image,
      options.connectionTimeout * TO_MILLISECONDS,
      env,
      bindMounts,
      logger
    )
    logger.debug(`Container created with id ${container.id}`)

    return runContainer(container, options.maxRuntime * TO_MILLISECONDS, options.maxResponseSize, logger)
  }
}



export {
  createRunner,
  image,
  ConnectionTimeoutError,
  ContainerCreationError,
  ContainerStartError,
  ContainerTimeoutError,
  ContainerExecutionError,
  ResponseTooLargeError
}


