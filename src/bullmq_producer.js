import { Queue, QueueEvents } from 'bullmq'
import { redisConfig } from './lib/bullmq_example.js'

const QUEUE_NAME = 'exampleQueue'
const QUEUE_CONFIG = {
  connection: redisConfig,
  // Max 100 jobs per 5 seconds
  limiter: {
    max: 100,
    duration: 5000
  },
  defaultJobOptions: {
    attempts: 5, // Number of attempts before failing
    backoff: {
      type: 'exponential',
      delay: 1000 // Delay between retries in milliseconds
    }
  }
}
const queue = new Queue(QUEUE_NAME,QUEUE_CONFIG)

const MIN_INTERVAL = 1000
const MAX_INTERVAL = 3000
function randomInterval(){
  return Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
}

let jobCounter = 1
async function addJob(queue) {
  const jobData = {
    counter: jobCounter++,
    attempts: 1
  }
  const job = await queue.add('exampleJob', jobData)
  console.log(`Added job ${job.id}`)
}


function addJobAndProgramNext(){
  addJob(queue)
  setTimeout(addJobAndProgramNext, randomInterval())
}


// Listen to completed events
const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConfig
})
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} has been completed with value ${returnvalue}`)
})

queueEvents.on('failed', async (job, _error) => {
  console.log(`*** Job with id ${job.id} has failed after all retry attempts.***`);
  // Here you can perform any cleanup tasks or log the failure
})


// Single job
addJob(queue)
// Multiple jobs
// addJobAndProgramNext()

// If you don't close, the script will hang indefinitely
// await queue.close()
