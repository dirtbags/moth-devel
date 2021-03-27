// jshint asi:true
import {toast, removeChildren} from "./common.mjs"

var workers = {}

// loadWorker returns an existing worker if one exists, otherwise, it starts a new worker
function loadWorker(language) {
    let worker = workers[language]
    if (!worker) {
        let url = new URL("scripts/workers/" + language + ".mjs", window.location)
        worker = new Worker(url)
        workers[language] = worker
    }
    return worker
}

export class Workspace {
    /**
     * 
     * @param element {HTMLElement} Element to populate with the workspace
     * @param id {String} A unique identifier of this workspace
     * @param code {String} The "pristine" source code for this workspace
     * @param language {String} The language for this workspace
     */
    constructor(element, id, code, language) {
        this.element = element
        this.originalCode = code
        this.language = language
        this.storageKey = "code:" + id

        // Get our document and window
        this.document = this.element.ownerDocument
        this.window = this.document.defaultView
    
        // Load user modifications, if there are any
        this.code = localStorage[this.storageKey] || this.originalCode
    
        this.status = this.element.querySelector(".status")
        this.linenos = this.element.querySelector(".editor .linenos")
        this.editor = this.element.querySelector(".editor .text")
        this.editor.classList.add("language-" + language)
        this.stdout = this.element.querySelector(".stdout")
        this.stderr = this.element.querySelector(".stderr")
        this.traceback = this.element.querySelector(".traceback")
        this.stdinfo = this.element.querySelector(".stdinfo")
        this.runButton = this.element.querySelector("button.run")
        this.revertButton = this.element.querySelector("button.revert")

        let outputElement = this.element.querySelector(".output")
        this.runButton.disabled = true
    
        // Load in the editor
        import("./codejar.mjs").then((module) => this.editorReady(module))

        // Load the interpreter
        this.initLanguage(language)

        this.runButton.addEventListener("click", () => this.run())
        this.revertButton.addEventListener("click", () => this.revert())
    }

    async initLanguage(language) {
        let start = performance.now()
        this.status.textContent = "Initializing..."
        this.worker = loadWorker(language)
        await this.workerReady()

        let runtime = performance.now() - start
        let duration = new Date(runtime).toISOString().slice(11, -1)        
        this.status.textContent = "Loaded in " + duration
        this.runButton.disabled = false

        for (let a of this.document.querySelectorAll(".files a")) {
            let filename = a.href.split("/").pop()
            this.workerWget(a.href)
            .then(ret => {
                this.stdinfo.appendChild(this.document.createElement("div")).textContent = "Downloaded " + filename
            })

        }
    }

    workerMessage(message) {
        let chan = new MessageChannel()
        message.channel = chan.port2
        this.worker.postMessage(message, [chan.port2])
        let p = new Promise(
            (resolve, reject) => {
                chan.port1.addEventListener("message", e => resolve(e.data), {once: true})
            }
        )
        chan.port1.start()
        return p
    }

    workerReady() {
        return this.workerMessage({type: "nop"})
    }

    workerWget(url) {
        return this.workerMessage({
            type: "wget",
            url: url,
        })
    }

    /**
     * highlight provides a code highlighter for CodeJar
     * 
     * It calls Prism.highlightElement, then updates line numbers
     */
    highlight(editor) {
        if (this.window.Prism) {
            // Sometimes it loads slowly
            this.window.Prism.highlightElement(editor)
        } else {
            console.warn("No highlighter!", this.window.Prism, this.window.document.scripts)
        }
        const code = editor.textContent || ""
        const lines = code.split("\n")
        let linesCount = lines.length
        if (lines[linesCount-1]) {
            linesCount += 1
        }

        let ltxt = ""
        for (let i = 1; i < linesCount; i++) {
            ltxt += i + "\n"
        }
        this.linenos.textContent = ltxt
    }
    
    /** 
     * Called when the editor has imported
     * 
     */
    editorReady(module) {
        this.jar = module.CodeJar(this.editor, (editor) => this.highlight(editor), {window: this.window})
        this.jar.updateCode(this.code)
        switch (this.language) {
            case "python":
                this.jar.updateOptions({
                    tab: "    ",
                    indentOn: /:$/,
                })
                break
        }
    }

    setAnswer(answer) {
        let evt = new CustomEvent("answer", {detail: {value: answer}, bubbles: true, cancelable: true})
        this.element.dispatchEvent(evt)

        this.stdinfo.appendChild(this.document.createTextNode("Set answer to "))
        this.stdinfo.appendChild(this.document.createElement("code")).textContent = answer
    }

    async run() {
        let start = performance.now()
        this.runButton.disabled = true
        this.status.textContent = "Running..."
        
        // Save first. Always save first.
        let program = this.jar.toString()
        if (program != this.originalCode) {
            localStorage[this.storageKey] = program
        }
        
        let result = await this.workerMessage({
            type: "run",
            code: program,
        })
        
        this.stdout.textContent = result.stdout
        this.stderr.textContent = result.stderr
        this.traceback.textContent = result.traceback
        removeChildren(this.stdinfo)
        if (result.answer) {
            this.setAnswer(result.answer)
        }

        let runtime = performance.now() - start
        let duration = new Date(runtime).toISOString().slice(11, -1)
        this.status.textContent = "Ran in " + duration
        this.runButton.disabled = false
    }
    
    revert() {
        let currentCode = this.jar.toString()
        let savedCode = localStorage[this.storageKey]
        if ((currentCode == this.originalCode) && savedCode) {
            this.jar.updateCode(savedCode)
            toast("Re-loaded saved code")
        } else {
            this.jar.updateCode(this.originalCode)
            toast("Reverted to original code")
        }
    }
}
