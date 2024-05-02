import { Queue } from 'bullmq'
import { redisConfig } from './lib/bullmq.js'

const QUEUE_NAME = 'exampleQueue'
const queue = new Queue(QUEUE_NAME,{connection: redisConfig })

// (async () => {
  const job = await queue.add('exampleJob', { data: 'some data' });
  console.log(`Added job ${job.id}`);
// })();
