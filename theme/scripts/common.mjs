// jshint asi:true

/**
 * Computes a DJB2 (Dan Bernstein) hash of the given message
 * 
 * @param message {String} text to hash
 */
export function DJB2Hash(message) {
  let h = 5381
  for (let c of (new TextEncoder()).encode(message)) { // Encode as UTF-8 and read in each byte
    // JavaScript converts everything to a signed 32-bit integer when you do bitwise operations.
    // So we have to do "unsigned right shift" by zero to get it back to unsigned.
    h = (((h * 33) + c) & 0xffffffff) >>> 0
  }
  return h
}

/**
 * Computes a SHA-256 hash of the given message
 * 
 * @param message {String} text to hash
 */
export async function SHA256Hash(message) {
  const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);           // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
  return hashHex;
}

/**
 * Pop up a message at the bottom of the screen
 * 
 * @param message {String} Message to pop up
 * @param timeout {Number} How long to leave it up, in milliseconds
 */
export function toast(message, timeout=8000) {
  let p = document.querySelector("#toasts").appendChild(document.createElement("p"))
  
  p.innerText = message
  setTimeout(
    evt => { p.remove() },
    timeout
  )
}

export function fail(...args) {
  toast("Oops, something is broken and needs to be fixed. Check console for details.")
  console.error("fail: %o", ...args)
}

export function softfail(...args) {
  toast("Oops, something is broken, but could work again soon. Check console for details.")
  console.group("Failure (soft)")
  for (let o of args) {
    console.warn(o)
  }
  console.groupEnd()
}

/**
 * Returns a new GUID
 * 
 * https://gist.github.com/jed/982883
 */
export function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

export function removeChildren(element) {
  while (element && element.firstChild) {
    element.firstChild.remove()
  }
}
