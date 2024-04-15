import amqp from 'amqplib'
import path from 'path'
import { fileURLToPath } from 'url'

import connectionURL from './connection.js'


const QUEUE = 'pending_corrections'



async function sendCorrection(message) {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(connectionURL())
    const channel = await connection.createChannel()

    // Send the message to the queue
    channel.sendToQueue(QUEUE, Buffer.from(message), { persistent: true })
    console.log(`Message sent: ${message}`)

    // Close the channel and connection
    await channel.close()
    await connection.close()
  } catch (error) {
    console.error('Error:', error)
  }
}

// Example usage

/*
  - work_id: optional, caller's id of the exercise
  - image: name of the image to run
  - file: file with the exercise
  - callback: URL to call with the results
*/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const correctionFile = path.join(__dirname, '..', 'example_exercise.txt')

const correctionData = {
  work_id: Math.floor(Math.random() * 1000),
  image: 'correction-test-1',
  file: correctionFile,
  callback: 'http://localhost/TO-DO'
}


sendCorrection(JSON.stringify(correctionData))
