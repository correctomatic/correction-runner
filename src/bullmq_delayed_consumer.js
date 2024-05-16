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
  console.log(`${now()} - Processing job ${job.id}`)
  await delay(10000)
  jobs.push(job)
  job.updateProgress('')
  return null
}, {
  connection: redisConfig,
  autorun: false
})


worker.run()
setInterval(() => {
  // This doesn't work
  const job = jobs.pop()
  if (!job) return
  console.log(`Delayed execution of ${job.id}`)
  job.moveToCompleted('Done', true)
}, 2000)



