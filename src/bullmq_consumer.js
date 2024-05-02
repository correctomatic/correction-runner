import { Worker } from 'bullmq';
import { redisConfig } from './config.js';

// Create a new BullMQ worker instance
const worker = new Worker('exampleQueue', async job => {
  // Simulate some asynchronous task
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log(`Processed job ${job.id}`);
  // You could do more work here depending on your application's needs
}, {
  connection: redisConfig,
});
