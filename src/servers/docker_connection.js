import {initializeDocker as initDocker } from '../lib/docker.js'
import env from '../env.js'

function initializeDocker() {
  initDocker(env.docker.DOCKER_SERVER)
}

export default initializeDocker
