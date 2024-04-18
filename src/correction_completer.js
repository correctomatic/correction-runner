import dotenv from 'dotenv'
dotenv.config()

import initializeDocker from './servers/docker_connection.js'
import { getDocker } from "./lib/docker.js"
import { RUNNING_QUEUE, FINISHED_QUEUE, getMessageChannel } from './servers/rabbitmq_connection.js'

/*
We should take in consideration the following scenarios:
1) The works arrives first to running queue and then the container finishes
2) The container finishes and then the work arrives to running queue

So for the messages in the running queue, we should:
- Check if the container has already finished, querying docker
- If the container has finished, we should:
  - Get the container logs
  - Remove the container
  - Remove from the running_works array
  - Send the message to the finished_works queue
- If the container has not finished:
  - Put the container in the running_works array, it will be completed
    when we receive an event from Docker

And for the finishing events in Docker:
- Check if the work is in the running_works array.
  If not, it will be processed when we receive the message in the running queue
- If it is, we should:
  - Get the container logs
  - Remove the container
  - Remove from the running_works array
  - Send the message to the finished_works queue
*/


// Works in running queue that are not yet finished
const running_works = []




function isADieEvent(event) {
  return event.Type === 'container' && ( event.Action === 'die' || event.Action === 'kill')
}

function isACorrectionContainer(container) {
}


// Listen for the running queue
async function listenForRunningQueue() {
  try {
    const channel = await getMessageChannel()
    channel.consume(RUNNING_QUEUE, async (message) => {
      try {
        if (message === null) return
        console.log('Received message:', message.content.toString())
        const runningTask = JSON.parse(message.content.toString())
        const container = await getDocker().getContainer(runningTask.id)
        const inspect = await container.inspect()
        if (inspect.State.Status === 'exited') {
          const logs = await container.logs()
          await container.remove()
          await sendToFinishedQueue(runningTask, logs)
        } else {
          running_works.push(runningTask)
        }
        channel.ack(message)
      } catch (error) {
        console.error('Error:', error)
      }
    })
  }catch (error) {
    console.error('Error:', error)
  }
}

async function listenForContainerCompletion() {
  // Filter for the event stream, doesn't seem to work
  const eventFilter = { event: 'die' }

  const eventStream = await getDocker().getEvents(eventFilter)

  eventStream.on('data', async function(chunk) {
    console.log('Event received:', chunk.toString())
    const event = JSON.parse(chunk.toString())
    if (isADieEvent(event)) {
      const id = event.Actor.ID
      console.log(`Container ${id} stopped`)
      // Check if the container is in the running_works array
      const index = running_works.findIndex(work => work.container_id === id)
      if (index === -1) console.log(`Container ${id} not found in running works, ignoring event`)

      console.log('Container found in running works, processing')
      const work = running_works[index]
      const logs = await getDocker().getContainerLogs(id)
      await getDocker().removeContainer(id)
      running_works.splice(index, 1)
      await sendToFinishedQueue(work, logs)
    }
  })

  eventStream.on('error', function(err) {
    console.error('Error listening to Docker events:', err)
  })
}

initializeDocker()
listenForRunningQueue()
listenForContainerCompletion()
