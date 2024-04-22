import initializeDocker from './servers/docker_connection.js'
import { getDocker } from "./lib/docker.js"
import { Writable } from 'stream'

/*
The problem is that the streams are multiplexed. The extra characters are the control characters
for stream multiplexing.
*/
/*

https://github.com/moby/moby/issues/32794

This is actually not broken! By default, logs over the wire are multiplexed using a package formerly known as github.com/docker/docker/pkg/stdcopy. This prepends a bit of data containing the message stream a log message belongs to (stdout or stderr) and the length of the log mess that belongs to that stream.

This is really poorly documented (which is partly my fault, now that I have also touched this part of the code) but a recent refactoring has abstracted the function that does this encoding to here, which is slightly better than the ad-hoc way things were before:

https://github.com/moby/moby/blob/master/api/server/httputils/write_log_stream.go

To demux this stream, there is a function in that same stdcopy package that is used to copy messages to two different stream represented stdout and stderr. Additionally, a third stream called Systemerr is muxed in and contains and errors that may have come from the logger AFTER it started. Those errors will cause stdcopy to stop and return the contents of the Systemerr message as a string an error.

I'm sorry this is so poorly documented. I hope this clarifies things a bit. Right now, there is no way to deliberately instruct the logging system to NOT multiplex streams, besides starting the container with a TTY (which has its own pitfalls in service logs right now).

*/


// // Create a writable stream backed by a buffer
// const writableStream = new Writable({
//   write(chunk, encoding, callback) {
//     // Write the chunk of data to a buffer
//     // For simplicity, we'll just log the data here
//     console.log('Received data:', chunk.toString());
//     callback(); // Call the callback to indicate that the chunk has been processed
//   }
// });


class MemoryWritableStream extends Writable {
  constructor() {
    super();
    this.buffer = ''
  }

  content() {
    return this.buffer
  }

  _write(chunk, encoding, callback) {
    this.buffer += chunk.toString()
    callback()
  }
}



async function streamToString(stream, encoding='utf-8') {
  const chunks = []

  for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString(encoding)
}


async function getContainerLogs(docker, containerIdOrName) {
  const container = docker.getContainer(containerIdOrName);

  return new Promise((resolve, reject) => {
    container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      const stdout = new MemoryWritableStream();
      const stderr = new MemoryWritableStream();

      container.modem.demuxStream(stream, stdout, stderr)

      let logs = '';
      stream.on('data', (chunk) => {
        logs += chunk.toString('utf8');
      });

      stream.on('end', async () => {
        console.log(stdout.content())
        console.log(stderr.content())
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
  return getContainerLogs(docker, containerIdOrName)
}

// const CONTAINER_NAME = 'correction-8a0a4670-986b-4625-975a-0a7392f68362'
// const CONTAINER_NAME = 'correctomatic-server-starter-1'
const CONTAINER_NAME = 'banana'

initializeDocker()
banana(CONTAINER_NAME).then((logs) => {
  console.log(logs)
})
