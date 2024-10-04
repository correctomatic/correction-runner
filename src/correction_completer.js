import { Queue, Worker } from 'bullmq'
import Ajv from 'ajv'

import mainLogger, { clearSensitiveFields } from './lib/logger.js'
import env from './config/env.js'

import initializeDocker from './servers/docker_connection.js'
import { getDocker, getContainerLogs } from "./lib/docker.js"

const MINUTE = 60 * 1000
// Production:
const LOCK_DURATION = 5 * MINUTE // Lock duration in ms
// Debug:
// const SECOND = 1000
// const LOCK_DURATION = 5 * SECOND // Lock duration in ms
const NUM_RECOVERS_FROM_STALL = 5
const LOCK_TOKEN = 'correction-completer' // Unique token for the lock

import {
  RUNNING_QUEUE_NAME,
  RUNNING_QUEUE_CONFIG,
  FINISHED_QUEUE_NAME,
  FINISHED_QUEUE_CONFIG
} from './config/bullmq.js'

import {
  CONTAINER_RESPONSE_SCHEMA
} from './schemas/index.js'

/*
----------------------------------------------------
----------------------------------------------------
Completion algorithm
----------------------------------------------------
----------------------------------------------------

We should take in consideration the following scenarios:
1) The works arrives first to running queue and then the container finishes (the normal case)
2) The container finishes and then the work arrives to the running queue

The program has two main loops: one for checking the running queue and another for listening to Docker events.

For the messages in the running queue, we should do the following:
-----------------------------------------------------------------
- Check if the container has already finished, querying docker
- If the container has finished, we should:
  - Complete the job
- If the container has not finished:
  - Put the container in the running_works array, it will be completed
    when we receive an event from Docker

For the finishing events in Docker:
---------------------------------------
- Check if the work is in the `runningWorks` array.
  If not, it will be processed when we receive the message in the running queue
- If it is, we should:
  - Complete the job
  - Remove from the running_works array


The process of completting a job is as follows:
  - Get the container logs
  - Remove the container
  - Send the message to the finished_works queue
  - Finish the message in the running queue
*/

/*
----------------------------------------------------
ACK mechanism
----------------------------------------------------

bullmq don't have a mechanism for acking messages as in RabbitMQ.
Instead, we do the following:

- Set a high `lockDuration`, enough to the docker containers have time to complete the correction
  It's configured in `LOCK_DURATION` constant
- Set a `maxStalledCount` to a high value, so the job is not aborted but retried.

The job will follow the following flow:
- Arrive to the running queue
- `runWorker` will adquire the lock
  - If the container is already finished, it will mark the job as completed, and the process will finish for that correction
  - If the container is still running, it will add the job to the `runningJobs` array
- The job will be locked until the lockDuration expires. No other worker will be able to take the job

Then, two things can happen:

1) The container finishes before the lock expires
    - The Docker's finalization event will be received in the Docker event listener
    - The job will be completed
2) The lock expires. This can happen because the container is stalled or the process crashes
    - The job will be retried by bullmq maxStalledCount times
      NOTE: WHAT WILL HAPPEN IF THE JOB IS STILL IN THE RUNNING QUEUE?
    - After that, the job will be moved to the failed queue

Maybe we should add a mechanism to refresh the locks, but it's not necessary for now

*/

const logger = mainLogger.child({ module: 'correction_starter' })
logger.debug(`Environment: ${JSON.stringify(clearSensitiveFields(env))}`)

// Works in running queue that are not yet finished
const runningJobs = []

// destroy and kill should remove the running task an return an error. The only acceptable
// event is die, which means the container has finished
function isAbnormalTerminationEvent(event) {
  return event.Type === 'container' && ( event.Action === 'kill' || event.Action === 'destroy')
}

function isADieEvent(event) {
  return event.Type === 'container' && event.Action === 'die'
}

function initializeAjv() {
  const options = {
    allErrors: false,
    verbose: false
  }
  return new Ajv(options)
}
let ajv = initializeAjv()
let responseValidator = ajv.compile(CONTAINER_RESPONSE_SCHEMA)

// The queue is opened only once, when the server starts
const finishedQueue = new Queue(FINISHED_QUEUE_NAME,FINISHED_QUEUE_CONFIG)

async function sendToFinishedQueue(job, logs, {error}={error:false}) {
  const { work_id, callback } = job.data
  const jobData = {
    work_id,
    error, // If set, finished with error (not failed)
    correction_data: logs,
    callback
  }

  await finishedQueue.add(job.name, jobData)
  logger.info(`Job sent to finished queue: ${JSON.stringify(jobData)}`)
}

async function failJob(job, result, errorMessage) {
  logger.error(`${result}: ${errorMessage}`)
  await sendToFinishedQueue(job,`${result} - ${errorMessage}`, { error: true })
  const failedMessage = `Job failed: ${errorMessage}`
  await job.moveToFailed(new Error(failedMessage), LOCK_TOKEN, false)
  return failedMessage
}

function searchCorrectomaticResponse(logs) {
  const regex = /-+BEGIN CORRECTOMATIC RESPONSE-+\n([\s\S]*?)\n-+END CORRECTOMATIC RESPONSE-+/g
  const matches = [...logs.matchAll(regex)];

  if(!matches) throw new Error('No correctomaitc response found in the output')
  if(matches.length > 1) throw new Error('More than one correctomatic response found in the output')
  return matches[0][1].trim()
}

function getCorrectomaticResponse(logs) {
  let response
  try {
    response = JSON.parse(logs)
  } catch (error) {
    if (error instanceof SyntaxError) {
      // We will try to find the reponse enclosed in separators
      response = JSON.parse(searchCorrectomaticResponse(logs))
    } else throw error
  }
  if(!responseValidator(response)) throw new Error('Invalid response format')
  return response
}

async function completeJob(job, container) {

  let logs
  try {
    logs = await getContainerLogs(container)
  } catch (error) {
    return failJob(job, 'Error getting container logs', error.message)
  }

  let response
  try {
    response = getCorrectomaticResponse(logs)
  } catch (error) {
    logger.debug(`Error in response format for the container ${job.data.container_id}: ${error.message}`)
    logger.debug(`Container response was:${logs}`)
    return failJob(job, 'Error processing container logs', error.message)
  }

  await container.remove()
  await sendToFinishedQueue(job, response)
  job.moveToCompleted(`Correction completed at ${new Date().toISOString()}`, LOCK_TOKEN, false)
}

//************************************************************************* */
// Loop for checking running queue
//************************************************************************* */
async function runWorker(worker) {
  let job

  try {
    await worker.startStalledCheckTimer()
    job = (await worker.getNextJob(LOCK_TOKEN))
    if(!job) return

    try {
      logger.info(`Received running job: ${JSON.stringify(job.data)}`)

      const container = await getDocker().getContainer(job.data.container_id)
      const inspect = await container.inspect()

      if (inspect.State.Status === 'exited') {
        // The container finished before we received the message
        logger.info('Container already finished, completing job')
        completeJob(job, container)
      } else {
        // The container is still running
        logger.info('Container still running, adding to running tasks')
        runningJobs.push(job)
      }
    } catch (error) {
      failJob(job, 'Error getting container results', error.message)
    }

  } catch (error) {
    logger.error(`Error: ${JSON.stringify(error.message)}`)
  }
}

async function listenForRunningQueue() {
  const queueOptions = {
    ...RUNNING_QUEUE_CONFIG,
    lockDuration: LOCK_DURATION,
    maxStalledCount: NUM_RECOVERS_FROM_STALL,
  }
  const worker = new Worker(RUNNING_QUEUE_NAME, null, queueOptions)

  while(true) {
    // This pauses the loop, it doesn't run all the time.
    // It's executed ~ 2secs if there are no pending jobs.
    // If a running job enters, it's executed inmediately.
    // eslint-disable-next-line no-await-in-loop
    await runWorker(worker)
  }
}

//************************************************************************* */
// Auxiliary functions for managing docker events
//************************************************************************* */

const byId = (id) => (job) => job.data.container_id === id
function getRunningJob(containerId) {
  return runningJobs.find(byId(containerId))
}

function removeRunningJob(containerId) {
  const index = runningJobs.findIndex(byId(containerId))
  if (index !== -1) {
    runningJobs.splice(index, 1)
  }
}

async function abnormalTermination(event){
  if(isAbnormalTerminationEvent(event)) {
    const containerId = event.Actor.ID
    const job = getRunningJob(containerId)
    if(job) {
      // TO-DO: create error in the finished queue
      logger.info(`Container ${containerId} was killed or destroyed`)
      removeRunningJob(containerId)
      failJob(job, 'Container was killed or destroyed', `Container ${containerId} was killed or destroyed`)
    }
    return true
  }
  return false
}

//************************************************************************* */
// Loop for checking docker events
//************************************************************************* */
async function listenForContainerCompletion() {
  // Filter for the event stream, but doesn't seem to work
  const eventFilter = { event: 'die' }
  const eventStream = await getDocker().getEvents(eventFilter)

  eventStream.on('data', async function(chunk) {
    logger.debug(`Docker event received: ${chunk.toString()}`)
    const event = JSON.parse(chunk.toString())

    if(await abnormalTermination(event)) return

    if (isADieEvent(event)) {
      const containerId = event.Actor.ID
      logger.debug(`Container ${containerId} finished`)

      const job = getRunningJob(containerId)
      if (!job) {
        logger.debug(`Container ${containerId} not found in running works, ignoring event`)
        return
      }

      try {
        logger.info(`Container ${containerId} found in running works, processing`)
        const container = await getDocker().getContainer(containerId)
        completeJob(job, container)
        removeRunningJob(containerId)
        logger.info(`Running job ${job.id} finished`)
      } catch (error) {
        failJob(job, 'Error getting container results', error.message)
      }
    }
  })

  eventStream.on('error', function(err) {
    logger.error(`Error listening to Docker events: ${err}`)
  })
}

logger.info('Starting correction completer...')
await initializeDocker(logger)
listenForRunningQueue()
listenForContainerCompletion()
