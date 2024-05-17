import { Queue, Worker } from 'bullmq'
import env from './config/env.js'

import mainLogger from './lib/logger.js'
import {
  PENDING_QUEUE_NAME,
  PENDING_QUEUE_CONFIG,
  RUNNING_QUEUE_NAME,
  RUNNING_QUEUE_CONFIG,
} from './config/bullmq.js'

import initializeDocker from './servers/docker_connection.js'
import { launchCorrectionContainer} from './lib/docker.js'

const logger = mainLogger.child({ module: 'correction_starter' })
logger.debug(`Environment: ${env}`)

// The queue is opened only once, when the server starts
const runningQueue = new Queue(RUNNING_QUEUE_NAME,RUNNING_QUEUE_CONFIG)

async function putInRunningQueue(jobName, work_id, containerId, callback) {
  const jobData = {
    work_id: work_id,
    container_id: containerId,
    callback: callback
  }
  await runningQueue.add(jobName, jobData)
  logger.debug(`Message sent to running queue: ${JSON.stringify(jobData)}`)
}

logger.info('Starting correction starter...')
initializeDocker()

logger.debug(`Pending queue config: ${JSON.stringify(PENDING_QUEUE_CONFIG)}`)
new Worker(PENDING_QUEUE_NAME, async job => {
  try {
    logger.info(`Received job: ${JSON.stringify(job.data)}`)
    const { work_id, image, file, callback } = job.data

    const containerId = await launchCorrectionContainer(image, file, logger)
    await putInRunningQueue(job.name, work_id, containerId, callback)

    logger.info(`Correction started. Container: ${containerId}`)
    return `Correction started at ${new Date().toISOString()}`

  } catch (error) {
    logger.error(`Error: ${error.message}`)
    // TODO: this should go to a queue for notifying the error
    throw error
  }
},PENDING_QUEUE_CONFIG)
