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

function createPromise(){
  let theResolve
  const promise = new Promise(resolve => { theResolve = resolve})
  promise.resolve = theResolve
  return promise
}

const _worker = new Worker(QUEUE_NAME, async job => {
  try {
    console.log(`${currentTime()} - Processing job ${job.id}`)

    const promise = createPromise()
    const pendingJob = {id: job.id, promise: promise}

    console.log('Adding job to pending list: ' + job.id)
    jobs.push(pendingJob)
    return await promise

  } catch (error) {
    console.error(error)
  }
}, {
  connection: redisConfig,
})

setInterval(() => {
  console.log('Checking for pending jobs')
  const pendingJob = jobs.pop()
  if (!pendingJob) return

  const { id, promise } = pendingJob

  console.log(`Completing the job ${id} outside of the worker `)
  promise.resolve(currentTime())

}, 5000)



/*
job stalled more than allowable limit

TO-DO: check this
https://docs.bullmq.io/patterns/manually-fetching-jobs
*/
