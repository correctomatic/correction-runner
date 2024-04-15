/*
- Reads from pending_corrections queue
- Check the load of the server
- Launchs the container with the correction
*/

import amqp from 'amqplib'
import connectionURL from './connection.js'
const QUEUE = 'pending_corrections'

async function mainLoop() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(connectionURL())
    const channel = await connection.createChannel()

    // Declare the queue from which you want to consume messages
    const queueName = 'pending_corrections'

    // Consume messages from the queue
    console.log('Waiting for messages...')
    channel.consume(queueName, (message) => {
      if (message !== null) {
        console.log('Received message:', message.content.toString())
        // Acknowledge receipt of the message
        channel.ack(message)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

mainLoop()

