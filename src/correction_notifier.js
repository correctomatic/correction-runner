import { canonicalize } from 'json-canonicalize'

import { Worker } from 'bullmq'
import env from './config/env.js'

import mainLogger, { clearSensitiveFields } from './lib/logger.js'
import {
  FINISHED_QUEUE_NAME,
  FINISHED_QUEUE_CONFIG
} from './config/bullmq.js'

const logger = mainLogger.child({ module: 'correction_notifier' })
logger.debug(`Environment: ${JSON.stringify(clearSensitiveFields(env))}`)

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

async function notify(jobData) {
  const { callback: url } = jobData

  const notificationData = buildNotificationData(jobData)
  const signedNotificationData = signResponse(notificationData)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: signedNotificationData,
  })

  if(!response.ok) {
    throw new Error(`Failed to send notification to ${url}. Status: ${response.status}`)
  }
}

/*
This will launch the worker that will send the notifications
It expects the following data in the job:
- work_id: optional, caller's id of the exercise
- error: false means that the correction has been completed.
- correction_data: correction or error in case the error field is true
- callback: URL to call with the results
*/
logger.debug(`Finished queue config: ${JSON.stringify(clearSensitiveFields(FINISHED_QUEUE_CONFIG))}`)
logger.info(`Starting ${env.bullmq.CONCURRENT_NOTIFIERS} concurrent notifiers`)
new Worker(FINISHED_QUEUE_NAME, async job => {
  try {
    logger.info(`Received job: ${JSON.stringify(job.data)}`)
    const { callback } = job.data

    logger.info(`Sending notification to ${callback}`)
    await notify(job.data)

    logger.info(`Notification sent successfully to ${callback}`)
    return(`Notification sent to ${callback} at ${new Date().toISOString()}`)

  } catch (error) {
    const errorMessage = `${(new Date()).toISOString()} Error sending notification: ${error.message}`
    logger.error(errorMessage)
    job.log(errorMessage)
    // Throwing an error retries the job, until max attempts are reached
    throw error
  }
},
{
  ...FINISHED_QUEUE_CONFIG,
  concurrency: env.bullmq.CONCURRENT_NOTIFIERS
})
