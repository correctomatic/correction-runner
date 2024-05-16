import { v4 as uuidv4 } from 'uuid';

const NAME_PREFIX = 'correction-';

function generateContainerName() {
  return NAME_PREFIX + uuidv4();
}

const nameRegEx = new RegExp(`^${NAME_PREFIX}[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`, 'i');
function isACorrectionContainerName(name) {
  return nameRegEx.test(name);
}

export {
  generateContainerName,
  isACorrectionContainerName
}
