import { Worker } from 'bullmq'
import { redisConfig } from './config/bullmq_example.js'

const QUEUE_NAME = 'exampleQueue'

// eslint-disable-next-line no-unused-vars
async function delay(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

function currentTime() {
  return new Date().toISOString()
}

const jobs = []

// Specify a unique token, shared between the worker and the async completer
const token = 'banana!!!'

const moreOptions = {
  lockDuration: 30000,
  /*
  Duration of the lock for the job in milliseconds. The lock represents that a worker is processing the job.
  If the lock is lost, the job will be eventually be picked up by the stalled checker and move back to wait
  so that another worker can process it again.
  */
  maxStalledCount: 1,
}

// Strategy to ack:
// - Set a high lockDuration, enough to the docker containers have time to complete the correction
//   (but not TOO high, or it won't be retried if the process crashes. Maybe 5 minutes is a good value?)
// - Set a maxStalledCount to a high value, so the job is not aborted but retried.
//   In theory the job shouldn't be retried a lot, perhaps one or two times if the docker container stalls, and two more
//   if the completer process crashes. Maybe 5 is a good value?
// - Renew locks somehow in the completer process? Don't seems very usefull, because if we renew indefinitely
//   the job won't fail if the container stalls. I think setting a high lockDuration is enough.

const worker = new Worker(QUEUE_NAME, null, {
  connection: redisConfig,
  ...moreOptions
})

async function runWorker() {

  await worker.startStalledCheckTimer()
  const job = (await worker.getNextJob(token))
  if(!job) {
    console.log('Worker - No jobs available')
    return
  }
  console.log(`Worker - Processing job ${job.id} - ${currentTime()}`)
  jobs.push(job)
  // await worker.close()
}

// setInterval(runWorker, 20000)

setInterval(() => {
  console.log('Completer - Checking for pending jobs...')
  const job = jobs.pop()
  if (!job) return

  // const { id, promise } = pendingJob
  console.log(`Completer - Completing the job ${job.id} - ${currentTime()}`)
  job.moveToCompleted('some return value', token, false)

}, 15000)

// This pauses for some time if there are no jobs available
while(true) {
  // eslint-disable-next-line no-await-in-loop
  await runWorker()
}

/*
job stalled more than allowable limit

TO-DO: check this
https://docs.bullmq.io/patterns/manually-fetching-jobs
*/
