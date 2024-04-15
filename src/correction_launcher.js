/*
- Reads from pending_corrections queue
- Check the load of the server
- Launchs the container with the correction
*/

import amqp from 'amqplib'
import Docker from 'dockerode'

import connectionURL, {PENDING_QUEUE, RUNNING_QUEUE}  from './rabbitmq_connection.js'
import {
  createCorrectionContainer as launchCorrectionContainer
} from './lib/docker.js'


function checkServerLoad() {
  // TO-DO: Implement server load checking
  return true
}

function putInRunningQueue(channel, work_id, containerId, callback) {
  const runningTask = {
    work_id: pendingTask.work_id,
    id: containerId,
    callback: pendingTask.callback
  }
  channel.sendToQueue(RUNNING_QUEUE, runningTask, { persistent: true })
  console.log('Message sent to running queue')
}

async function mainLoop() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(connectionURL())
    const channel = await connection.createChannel()

    // Consume messages from the queue
    console.log('Waiting for messages...')
    channel.consume(PENDING_QUEUE, (message) => {
      if (message !== null) {
        console.log('Received message:', message.content.toString())
        const pendingTask = JSON.parse(message.content.toString())

        // Check the server load
        if (!checkServerLoad()) {
          console.log('Server is overloaded, waiting...')
          return
        }

        const containerId = launchCorrectionContainer(pendingTask.image, pendingTask.file)
        putInRunningQueue(channel, pendingTask.work_id, containerId, pendingTask.callback)

        // Acknowledge receipt of the message
        channel.ack(message)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

//mainLoop()
launchCorrectionContainer('correction-test-1', [])

