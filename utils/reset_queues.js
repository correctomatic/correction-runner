import {
  PENDING_QUEUE_NAME,
  RUNNING_QUEUE_NAME,
  FINISHED_QUEUE_NAME,

  PENDING_QUEUE_CONFIG,
  RUNNING_QUEUE_CONFIG,
  FINISHED_QUEUE_CONFIG
} from '../src/config/bullmq.js'
import { deleteQueue } from '../src/lib/delete_queue.js'

throw new Error('Comment this line to delete the queues')

/* eslint-disable no-unreachable */
deleteQueue(PENDING_QUEUE_NAME, PENDING_QUEUE_CONFIG)
deleteQueue(RUNNING_QUEUE_NAME, RUNNING_QUEUE_CONFIG)
deleteQueue(FINISHED_QUEUE_NAME, FINISHED_QUEUE_CONFIG)

// TODO: remove after finishing the tests with bullmq
import { redisConfig } from '../src/config/bullmq_example.js'
deleteQueue('exampleQueue', { connection: redisConfig})
