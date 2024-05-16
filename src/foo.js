let foo

// Define a promise
const myPromise = new Promise((resolve, reject) => {
  foo = resolve;
  // This promise doesn't resolve immediately, it waits for some other function to resolve it
  // You can pass the resolve function to other parts of your code and call it when appropriate
});

// Function that resolves the promise
function resolvePromise() {
  // This function resolves the promise with a value
  myPromise.then((result) => {
    console.log("Promise resolved with:", result);
  });

  // Simulate some asynchronous operation
  setTimeout(() => {
    foo("Resolved value");
  }, 3000);
}

// Call the function to resolve the promise
resolvePromise();
