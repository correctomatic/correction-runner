import { Queue } from 'bullmq'
import { redisConfig } from './lib/bullmq.js'

const QUEUE_NAME = 'exampleQueue'
const QUEUE_CONFIG = {
  connection: redisConfig,
  // Max 100 jobs per 5 seconds
  limiter: {
    max: 100,
    duration: 5000
  }
}
const queue = new Queue(QUEUE_NAME,QUEUE_CONFIG)

const INTERVAL_BETWEEN_JOBS = 5000

let jobData = 1
async function addJob(queue) {
  const job = await queue.add('exampleJob', { counter: jobData++ })
  console.log(`Added job ${job.id}`)
}

addJob(queue)
setInterval(async () => addJob(queue), INTERVAL_BETWEEN_JOBS)

queue.on('completed', (job, result) => {
  console.log(`Job with id ${job.id} has been completed`)
})

// If you don't close, the script will hang indefinitely
// await queue.close()
