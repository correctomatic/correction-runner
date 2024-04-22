import initializeDocker from './servers/docker_connection.js'
import { getDocker } from "./lib/docker.js"


async function getContainerLogs_OLD(docker, containerIdOrName) {
  const container = docker.getContainer(containerIdOrName);

  return new Promise((resolve, reject) => {
    container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let logs = '';
      stream.on('data', (chunk) => {
        logs += chunk.toString('utf8');
      });

      stream.on('end', () => {
        resolve(logs);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  });
}


async function banana(containerIdOrName) {
  const docker = getDocker()
  // return getContainerLogs(docker, containerIdOrName)

  const container = docker.getContainer(containerIdOrName);
  container.logs({ follow: false, stdout: true, stderr: true }, (err, stream) => {
    if (err) {
      reject(err);
      return;
    }

    let logs = '';
    stream.on('data', (chunk) => {
      logs += chunk.toString('utf8');
    });

    stream.on('end', () => {
      resolve(logs);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

// const CONTAINER_NAME = 'correction-8a0a4670-986b-4625-975a-0a7392f68362'
const CONTAINER_NAME = 'correctomatic-server-starter-1'

initializeDocker()
banana(CONTAINER_NAME).then((logs) => {
  console.log(logs)
})
