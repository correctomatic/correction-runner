import axios from 'axios'
import { canonicalize } from 'json-canonicalize'

import { Worker } from 'bullmq'
import env from './config/env.js'

import mainLogger from './lib/logger.js'
import {
  FINISHED_QUEUE_NAME,
  FINISHED_QUEUE_CONFIG
} from './config/bullmq.js'

// Connection timeout for notifications
const CONNECTION_TIMEOUT = 5000

const LOCK_TOKEN = 'correction_notifier'

const logger = mainLogger.child({ module: 'correction_notifier' })
logger.debug(`Environment: ${JSON.stringify(env)}`)

/*
We have two types of responses:
- Success: { success: true, work_id, grade, comments }
- Failure: { success: false, work_id, error }

The container response (stored in container_data) will have the following structure:
{
  success: true,
  grade: 10,
  comments: ['Good job!']
}
In case of error:
{
  success: false,
  error: 'Invalid file format'
}

We just need to add the work_id to correction_data and sign the response
*/

function signResponse(response) {
  const canonicalized = canonicalize(response)
  // TO-DO: Sign the response
  return canonicalized
}

function buildNotificationData(jobData) {
  return {
    work_id: jobData.work_id,
    ...jobData.correction_data
  }
}

/*
This will launch the proces that will send the notifications. We could have multiple
processes running at the same time, each one will send a notification for a job.

It expects the following data in the job:
- work_id: optional, caller's id of the exercise
- error: false means that the correction has been completed.
- correction_data: correction or error in case the error field is true
- callback: URL to call with the results
*/
async function notify(job) {
  const { callback: url } = job.data

  logger.info(`Sending notification to ${url}`)
  const notificationData = buildNotificationData(job.data)
  const signedNotificationData = signResponse(notificationData)

  try {

    const response = await axios.post(url, signedNotificationData, {
      headers: {
        'Content-Type': 'application/json'
      },
      CONNECTION_TIMEOUT
    })

    if(!response.ok) {
      const errorMessage = `Error sending notification to ${url}. Status: ${response.status}`
      logger.error(errorMessage)
      throw new Error(errorMessage)
    }

    const successMessage = `Notification sent to ${url}. Status: ${response.status}`
    logger.info(successMessage)
    job.moveToCompleted(successMessage, LOCK_TOKEN, false)

  } catch (error) {
    logger.error(`Error sending notification to ${url}: ${error.message}`)
    throw error
  }
}

async function runWorker(worker) {
  let job

  try {
    await worker.startStalledCheckTimer()
    job = (await worker.getNextJob(LOCK_TOKEN))
    if(!job) return

    logger.info(`Received finished job: ${JSON.stringify(job.data)}. Launching notification.`)

    // Note that we do NOT await the notification, we just launch it
    // Multiple notifications can be launched at the same time
    notify(job)

  } catch (error) {
    logger.error(`Error: ${JSON.stringify(error.message)}`)
    throw error
  }
}

async function listenForFinishedQueue() {
  // We need to set the lock duration to a value higher than the connection timeout
  const LOCK_DURATION = 2*CONNECTION_TIMEOUT
  logger.info(`Listening for finished queue jobs. Lock duration: ${LOCK_DURATION}ms`)

  const queueOptions = {
    ...FINISHED_QUEUE_CONFIG,
    lockDuration: LOCK_DURATION
  }
  const worker = new Worker(FINISHED_QUEUE_NAME, null, queueOptions)

  while(true) {
    // This pauses the loop, it doesn't run all the time.
    // It's executed ~ 2secs if there are no pending jobs.
    // If a running job enters, it's executed inmediately.
    // eslint-disable-next-line no-await-in-loop
    await runWorker(worker)
  }
}

listenForFinishedQueue()





