importScripts('https://cdn.jsdelivr.net/pyodide/v0.16.1/full/pyodide.js')

const HOME = "/home/web_user"

async function init() {
    await languagePluginLoader
    self.pyodide._module.FS.chdir(HOME)
    self.pyodide.runPython("import sys")
    self.postMessage({type: "loaded"})
}
const initialized = init()

class Buffer {
    constructor() {
        this.buf = []
    }

    write(s) {
        this.buf.push(s)
    }

    value() {
        return this.buf.join("")
    }
}

async function handleMessage(event) {
    let data = event.data
    
    await initialized
    let fs = self.pyodide._module.FS

    let ret = {
        result: null,
        answer: null,
        stdout: null,
        stderr: null,
        traceback: null,
    }

    switch (data.type) {
        case "nop":
            // You might want to do nothing in order to display to the user that a run can now be handled
            break
        case "run":
            self.pyodide.globals.sys.stdout = new Buffer()
            self.pyodide.globals.sys.stderr = new Buffer()
            self.pyodide.globals.setanswer = ((s) => {ret.answer = s})

            try {
                ret.result = await self.pyodide.runPythonAsync(data.code)
            } catch (err) {
                ret.traceback = err
            }
            ret.stdout = self.pyodide.globals.sys.stdout.value()
            ret.stderr = self.pyodide.globals.sys.stderr.value()
            break
        case "wget":
            let url = data.url
            let dir = data.directory || fs.cwd()
            let filename = url.split("/").pop()
            let path = dir + "/" + filename

            if (fs.analyzePath(path).exists) {
                fs.unlink(path)
            }
            fs.createLazyFile(dir, filename, url, true, false)
            break
        default:
            ret.result = "Unknown message type: " + data.type
            break
    }
    if (data.channel) {
        data.channel.postMessage(ret)
    }
}
self.addEventListener("message", e => handleMessage(e))

