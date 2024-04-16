/*
- Reads from pending_corrections queue
- Check the load of the server
- Launchs the container with the correction
*/

import amqp from 'amqplib'

import connectionURL, {PENDING_QUEUE, RUNNING_QUEUE}  from './rabbitmq_connection.js'
import {
  createCorrectionContainer as launchCorrectionContainer
} from './lib/docker.js'


function checkServerLoad() {
  // TO-DO: Implement server load checking
  return true
}

async function getMessageChannel() {
  const connection = await amqp.connect(connectionURL())
  return connection.createChannel()
}

function putInRunningQueue(channel, work_id, containerId, callback) {
  const runningTask = {
    work_id: work_id,
    id: containerId,
    callback: callback
  }
  channel.sendToQueue(RUNNING_QUEUE, runningTask, { persistent: true })
  console.log('Message sent to running queue')
}

async function mainLoop() {
  try {
    const channel = await getMessageChannel()

    console.log('Waiting for messages...')
    channel.consume(PENDING_QUEUE, (message) => {
      if (message !== null) {
        console.log('Received message:', message.content.toString())
        const pendingTask = JSON.parse(message.content.toString())

        if (!checkServerLoad()) {
          console.log('Server is overloaded, waiting...')
          return
        }

        const containerId = launchCorrectionContainer(pendingTask.image, pendingTask.file)
        putInRunningQueue(channel, pendingTask.work_id, containerId, pendingTask.callback)

        channel.ack(message)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

//mainLoop()
launchCorrectionContainer('correction-test-1', [])

