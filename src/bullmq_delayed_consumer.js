import { Worker } from 'bullmq'
import { redisConfig } from './config/bullmq_example.js'

const QUEUE_NAME = 'exampleQueue'

// eslint-disable-next-line no-unused-vars
async function delay(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

function now() {
  return new Date().toISOString()
}

const jobs = []

const worker = new Worker(QUEUE_NAME, async job => {
  try {
    console.log(`${now()} - Processing job ${job.id}`)

    let theResolve
    const promise = new Promise((resolve, _reject) => { theResolve = resolve})
    promise.resolve = theResolve
    const pendingJob = {id: job.id, promise: promise}

    console.log('Adding job to pending list: ' + JSON.stringify(pendingJob))
    jobs.push(pendingJob)
    return await promise
  } catch (error) {
    console.error(error)
  }
}, {
  connection: redisConfig,
  autorun: false
})


worker.run()
setInterval(() => {
  console.log('Checking for pending jobs')
  const pendingJob = jobs.pop()
  console.log(pendingJob)
  if (!pendingJob) return
  const { id, promise } = pendingJob
  console.log(`Delayed execution of ${id}`)
  promise.resolve(new Date().toISOString())
}, 2000)



