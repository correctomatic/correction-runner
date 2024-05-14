import { Worker } from 'bullmq'

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

function putInRunningQueue(channel, work_id, containerId, callback) {
  const runningTask = {
    work_id: work_id,
    id: containerId,
    callback: callback
  }
  const message = Buffer.from(JSON.stringify(runningTask))
  channel.sendToQueue(RUNNING_QUEUE, message, { persistent: true })
  logger.info('Message sent to running queue')
}




logger.info('Starting correction starter...')
initializeDocker()
// mainLoop()

const _worker = new Worker(PENDING_QUEUE_NAME, async job => {
  try {
    logger.info(`Received job: ${JSON.stringify(job.data)}`)
    const { work_id, image, file, callback } = job.data

    const containerId = await launchCorrectionContainer(image, file)
    putInRunningQueue(work_id, containerId, callback)

    logger.info(`Correction started. Container: ${containerId}`)
    return `Started at ${new Date().toISOString()}`

  } catch (error) {
    logger.error('Error:', error)
    throw error
  }
},PENDING_QUEUE_CONFIG)
