import fs from 'fs'

function mergeDeep(target, source) {
  const output = {...target}
  if (typeof target === 'object' && typeof source === 'object') {
    Object.keys(source).forEach(key => {
      if (source[key] instanceof Object && key in target) {
        output[key] = mergeDeep(target[key], source[key])
      } else {
        output[key] = source[key]
      }
    })
  }
  return output
}

function readFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8')
  return fileContent
}

export {
  mergeDeep,
  readFile
}
