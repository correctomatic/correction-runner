/*
- Reads from pending_corrections queue
- Check the load of the server
- Launchs the container with the correction
*/

import amqp from 'amqplib'
import connectionURL, {PENDING_QUEUE, RUNNING_QUEUE}  from './connection.js'

function checkServerLoad() {
  // TO-DO: Implement server load checking
  return true
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

        // Launch container
        // TO-DO: Implement container launch
        const containerId = 'TO-DO'

        // Put the message in the running queue
        // - work_id: optional, caller's id of the exercise
        // - id: ID of the container running the correction
        // - callback: URL to call with the results
        const runningTask = {
          work_id: pendingTask.work_id,
          id: containerId,
          callback: pendingTask.callback
        }

        channel.sendToQueue(RUNNING_QUEUE, runningTask, { persistent: true })
        console.log('Message sent to running queue')

        // Acknowledge receipt of the message
        channel.ack(message)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

mainLoop()

