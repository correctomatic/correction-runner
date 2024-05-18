import { Worker } from 'bullmq'
import env from './config/env.js'

import mainLogger from './lib/logger.js'
import {
  FINISHED_QUEUE_NAME,
  FINISHED_QUEUE_CONFIG
} from './config/bullmq.js'


const logger = mainLogger.child({ module: 'correction_notifier' })
logger.debug(`Environment: ${JSON.stringify(env)}`)

async function notifyURL(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    // TO-DO: Add the real message
    body: JSON.stringify({ message: 'Notification message' }),
  })
  if(!response.ok) {
    throw new Error(`Failed to send notification to ${url}. Status: ${response.status}`)
  }
}


logger.debug(`Pending queue config: ${JSON.stringify(FINISHED_QUEUE_CONFIG)}`)
/*
finished_corrections:
- work_id: optional, caller's id of the exercise
- error: false means that the correction has been completed.
- correction_data: correction or error in case the error field is true
- callback: URL to call with the results
*/
// This will launch the worker that will send the notifications
new Worker(FINISHED_QUEUE_NAME, async job => {
  try {
    logger.info(`Received job: ${JSON.stringify(job.data)}`)

    const { work_id, error, correction_data, callback } = job.data

    logger.info(`Sending notification to ${callback}`)
    await notifyURL(callback)

    logger.info('Notification sent successfully to', callback)
    return(`Notification sent to ${callback} at ${new Date().toISOString()}`)

  } catch (error) {
    logger.error(`Error sending notification: ${error.message}`)
    // Throw the error to retry the job
    throw error
  }
},FINISHED_QUEUE_NAME)
