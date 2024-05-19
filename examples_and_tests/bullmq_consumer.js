import { Worker } from 'bullmq'
import { redisConfig } from './lib/bullmq_example.js'

const QUEUE_NAME = 'exampleQueue'

// eslint-disable-next-line no-unused-vars
async function delay(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

function now() {
  return new Date().toISOString()
}

const _worker = new Worker(QUEUE_NAME, async job => {

  const ERROR_RATE = 0.9

  console.log(`${now()} - Processing job ${job.id}`)

  if (Math.random() < ERROR_RATE) {
    console.log(`${now()} - Job ${job.id} ERROR`)
    job.updateData({ attempts: job.data.attempts + 1 })
    throw new Error('Random error occurred')
  }

  // await delay(2000)
  console.log(`${now()} - Job ${job.id} done - attempts: ${job.data.attempts}`)
  return 'banana!'
}, {
  connection: redisConfig,
})
