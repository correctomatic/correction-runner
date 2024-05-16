import { Queue } from 'bullmq'

async function deleteQueue(queueName, queueConfig) {

  const queue = new Queue(queueName, queueConfig)

  // Pause the queue
  await queue.pause()

  // Remove all jobs
  await queue.clean(0, 'completed')
  await queue.clean(0, 'waiting')
  await queue.clean(0, 'active')
  await queue.clean(0, 'delayed')
  await queue.clean(0, 'failed')

  // Optionally, drain the queue
  await queue.drain()

  // Obliterate the queue
  await queue.obliterate({ force: true })

  // Close the queue
  await queue.close()
}

export { deleteQueue }
