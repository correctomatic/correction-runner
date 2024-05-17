import { Queue, Worker } from 'bullmq'

import mainLogger from './lib/logger.js'
import env from './config/env.js'

import initializeDocker from './servers/docker_connection.js'
import { getDocker, getContainerLogs } from "./lib/docker.js"

const MINUTE = 60 * 1000
const SECOND = 1000
// Production:
const LOCK_DURATION = 5 * MINUTE // Lock duration in ms
// Debug:
// const LOCK_DURATION = 5 * SECOND // Lock duration in ms
const REFRESH_LOCK_INTERVAL = 1 * MINUTE
const NUM_RECOVERS_FROM_STALL = 5
const LOCK_TOKEN = 'correction-completer' // Unique token for the lock

import {
  RUNNING_QUEUE_NAME,
  RUNNING_QUEUE_CONFIG,
  FINISHED_QUEUE_NAME,
  FINISHED_QUEUE_CONFIG
} from './config/bullmq.js'

/*
----------------------------------------------------
Completion algorithm
----------------------------------------------------

We should take in consideration the following scenarios:
1) The works arrives first to running queue and then the container finishes (the normal case)
2) The container finishes and then the work arrives to running queue

So for the messages in the running queue, we should:
- Check if the container has already finished, querying docker
- If the container has finished, we should:
  - Complete the job
- If the container has not finished:
  - Put the container in the running_works array, it will be completed
    when we receive an event from Docker

And for the finishing events in Docker:
- Check if the work is in the running_works array.
  If not, it will be processed when we receive the message in the running queue
- If it is, we should:
  - Complete the job
  - Remove from the running_works array


The process of completting a job is as follows:
  - Get the container logs
  - Remove the container
  - Send the message to the finished_works queue
*/

/*
----------------------------------------------------
ACK mechanism
----------------------------------------------------

bullmq don't have a mechanism for acking messages as in RabbitMQ.
Instead, we do the following:

- Set a high lockDuration, enough to the docker containers have time to complete the correction
  It's configured in `LOCK_DURATION` constant
- Set a maxStalledCount to a high value, so the job is not aborted but retried.

The job will follow the following flow:
-


// Strategy to ack:
// - Set a high lockDuration, enough to the docker containers have time to complete the correction
//   (but not TOO high, or it won't be retried if the process crashes. Maybe 5 minutes is a good value?)
// - Set a maxStalledCount to a high value, so the job is not aborted but retried.
//   In theory the job shouldn't be retried a lot, perhaps one or two times if the docker container stalls, and two more
//   if the completer process crashes. Maybe 5 is a good value?
// - Renew locks somehow in the completer process? Don't seems very usefull, because if we renew indefinitely
//   the job won't fail if the container stalls. I think setting a high lockDuration is enough.


*/

const logger = mainLogger.child({ module: 'correction_starter' })
logger.debug(`Environment: ${JSON.stringify(env)}`)

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

/*
The process of completting a job is as follows:
  - Get the container logs
  - Remove the container
  - Send the message to the finished_works queue
*/
async function completeJob(job, container) {
  const logs = await getContainerLogs(container)
  //TO-DO: validate response format (ajv?)
  await container.remove()
  await sendToFinishedQueue(job, logs)
  // TO-DO: return value?
  job.moveToCompleted('some return value', LOCK_TOKEN, false)
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
      logger.error(`Error getting container results: ${JSON.stringify(error.message)}`)
      // We will notify that the correction failed
      sendToFinishedQueue(job, 'Error getting container results', { error: true })
      // TO-DO: return value?
      job.moveToCompleted('some return value', LOCK_TOKEN, false)
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
function getRunningTask(containerId) {
  return runningJobs.find(byId(containerId))
}

function removeRunningWork(containerId) {
  const index = runningJobs.findIndex(byId(containerId))
  if (index !== -1) {
    runningJobs.splice(index, 1)
  }
}

function abnormalTermination(event){
  if(isAbnormalTerminationEvent(event)) {
    const containerId = event.Actor.ID
    const task = getRunningTask(containerId)
    if(task) {
      // TO-DO: create error in the finished queue
      logger.info(`Container ${containerId} was killed or destroyed`)
    }
    return true
  }
  return false
}


//************************************************************************* */
// Loop for checking running queue
//************************************************************************* */

//************************************************************************* */
// OLD
//************************************************************************* */
async function listenForContainerCompletion() {
  // Filter for the event stream, but doesn't seem to work
  const eventFilter = { event: 'die' }
  const eventStream = await getDocker().getEvents(eventFilter)

  eventStream.on('data', async function(chunk) {
    console.log('Event received:', chunk.toString()) // debug
    const event = JSON.parse(chunk.toString())

    if(abnormalTermination(event)) return

    if (isADieEvent(event)) {
      const id = event.Actor.ID
      console.log(`Container ${id} finished`)

      const task = getRunningTask(id)
      if (!task) {
        console.log(`Container ${id} not found in running works, ignoring event`)
        return
      }

      try {
        console.log('Finished container found in running works, processing')
        const container = await getDocker().getContainer(id)
        completeJob(task.message, container, task.work)
        removeRunningWork(id)
        console.log('Running work acknowledged')
      } catch (error) {
        console.error('Error:', error)
        // We will notify that the correction failed
        await sendToFinishedQueue(channel, task.work, 'Error getting container results', { error: true })
      }
    }
  })

  eventStream.on('error', function(err) {
    console.error('Error listening to Docker events:', err)
  })
}
//************************************************************************* */

logger.info('Starting correction completer...')
initializeDocker()
listenForRunningQueue()
// listenForContainerCompletion()
