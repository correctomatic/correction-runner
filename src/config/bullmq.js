import env from './env.js'

const PENDING_QUEUE_NAME = 'pending_corrections'
const RUNNING_QUEUE_NAME = 'running_corrections'
const FINISHED_QUEUE_NAME = 'finished_corrections'

// Common configuration for all queues
const redisConfig = {
  host: env.redis.REDIS_HOST,
  port: env.redis.REDIS_PORT,
  password: env.redis.REDIS_PASSWORD
}

// ---------------------------------------------------------
// This is the queue used for starting new jobs
//
// The system will take the job from this queue and
// start the correction.
//
// It's the heavier process (it starts the docker container)
// so we limit the number of jobs per second
// ---------------------------------------------------------
const PENDING_QUEUE_CONFIG = {
  connection: redisConfig,
  // Max 10 jobs per 5 seconds
  limiter: {
    max: 10,
    duration: 5000
  }
}

// ---------------------------------------------------------
// TODO
// ---------------------------------------------------------
const RUNNING_QUEUE_CONFIG = {
  connection: redisConfig,
}

// ---------------------------------------------------------
// This is the queue used for the finished jobs
//
// The system will send the HTTP request to the hook
// specified in the job data
//
// It retries the notification, in case the hook fails
// ---------------------------------------------------------
const FINISHED_QUEUE_CONFIG = {
  connection: redisConfig,
  // Max 20 notifications per second
  limiter: {
    max: 20,
    duration: 1000,
  },
  // The notifications are retried
  defaultJobOptions: {
    attempts: 5, // Number of attempts before failing
    backoff: {
      type: 'exponential',
      delay: 2000 // Delay between retries in milliseconds
    }
  }
}

export {
  PENDING_QUEUE_NAME,
  RUNNING_QUEUE_NAME,
  FINISHED_QUEUE_NAME,

  PENDING_QUEUE_CONFIG,
  RUNNING_QUEUE_CONFIG,
  FINISHED_QUEUE_CONFIG,
}
