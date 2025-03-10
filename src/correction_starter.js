import { Queue, Worker } from 'bullmq'
import env from './config/env.js'

import mainLogger, { clearSensitiveFields } from './lib/logger.js'
import {
  PENDING_QUEUE_NAME,
  PENDING_QUEUE_CONFIG,
  RUNNING_QUEUE_NAME,
  RUNNING_QUEUE_CONFIG,
} from './config/bullmq.js'

import initializeDocker from './servers/docker_connection.js'
import { launchCorrectionContainer} from './lib/docker.js'

let runningQueue
let worker

const logger = mainLogger.child({ module: 'correction_starter' })
logger.debug(`Environment: ${JSON.stringify(clearSensitiveFields(env))}`)

logger.info('Starting correction starter...')
await initializeDocker(logger)

const cleanup = async () => {
  logger.info('Shutting down gracefully...')
  try {
    // Close BullMQ queues and workers
    await runningQueue.close()
    logger.info('Running queue closed.')
    await worker.close()
    logger.info('Worker closed.')
    logger.info('All resources cleaned up.')
    process.exit(0)
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`)
  } finally {
    process.exit(0)
  }
}

// Capture SIGINT and SIGTERM signals
process.on('SIGINT', async () => {
  logger.info('SIGINT received.')
  await cleanup()
})

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received.')
  await cleanup()
})


// The queue is opened only once, when the server starts
runningQueue = new Queue(RUNNING_QUEUE_NAME,RUNNING_QUEUE_CONFIG)

async function putInRunningQueue(jobName, work_id, containerId, callback) {
  const jobData = {
    work_id: work_id,
    container_id: containerId,
    callback: callback
    // file_hash: file_hash // TO-DO: add file_hash
  }
  await runningQueue.add(jobName, jobData)
  logger.debug(`Message sent to running queue: ${JSON.stringify(jobData)}`)
}

logger.debug(`Pending queue config: ${JSON.stringify(clearSensitiveFields(PENDING_QUEUE_CONFIG))}`)
worker = new Worker(PENDING_QUEUE_NAME, async job => {
  try {
    logger.info(`Received job: ${JSON.stringify(job.data)}`)
    const { work_id, image, file, callback, params } = job.data

    const containerId = await launchCorrectionContainer(image, file, params, logger)
    await putInRunningQueue(job.name, work_id, containerId, callback)

    logger.info(`Correction started. Container: ${containerId}`)
    return `Correction started at ${new Date().toISOString()}`

  } catch (error) {
    logger.error(`Error: ${error.message}`)
    // TODO: this should go to a queue for notifying the error
    throw error
  }
},PENDING_QUEUE_CONFIG)
