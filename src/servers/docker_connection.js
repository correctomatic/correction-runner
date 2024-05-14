import {initializeDocker as initDocker } from '../lib/docker.js'
import env from '../config/env.js'

function initializeDocker() {
  initDocker(env.docker.DOCKER_SERVER)
}

export default initializeDocker
