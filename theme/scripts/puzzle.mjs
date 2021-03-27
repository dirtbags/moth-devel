// jshint asi:true

import { removeChildren } from "./common.mjs"
import {toast, fail, softfail, SHA256Hash} from "./common.mjs"
import {Workspace} from "./workspace.mjs"

export class Puzzle {
  constructor(contentElement, cli) {
    this.contentElement = contentElement
    this.cli = cli
    this.document = this.contentElement.ownerDocument
    this.puzzleElement = this.contentElement.querySelector("iframe.puzzle")
    this.answerElement = this.contentElement.querySelector("#answer")
    this.formElement = this.contentElement.querySelector("form")
    this.infoElement = this.document.querySelector("#puzzle_info")
    this.obj = null // This turns into the puzzle object when it becomes available
    this.cat = null
    this.points = null
    
    this.answerElement.addEventListener("input", evt => this.checkAnswer(evt))
    this.formElement.addEventListener("submit", evt => this.submit(evt))
    this.infoElement.addEventListener("click", evt => this.infoClicked(evt))
    for (let el of this.contentElement.querySelectorAll("button.puzzle_info")) {
      el.addEventListener("click", evt => this.showPuzzleInfo(evt))
    }

    // sigh, JavaScript
    this.unboundAnswerEvent = (e) => this.answerEvent(e)
  }
    
  fetch(url, options={}) {
    return this.cli.fetch(url, options)
  }
  
  newDocument() {
    let idoc = this.puzzleElement.contentDocument // iframe document: can change between invocations!
    idoc.removeEventListener("answer", this.unboundAnswerEvent)
    idoc.addEventListener("answer", this.unboundAnswerEvent)

    // After much twiddling around, I have determined the best way to do this
    // is to take the existing Document, clear it out, and build it back up.
    // Otherwise you have to wait for the DOM Content Load and it's just a mess.
    while (idoc.body.firstChild) {
      idoc.body.firstChild.remove()
    }

    // Set the base URL, so requests work right
    let baseElement = idoc.querySelector("base")
    if (! baseElement) {
      baseElement = idoc.head.appendChild(idoc.createElement("base"))
    }
    baseElement.href = this.baseURI.href

    let cssUrls = new Set()
    cssUrls.add((new URL("css/puzzle.css", document.baseURI)).toString())
    cssUrls.add("https://cdnjs.cloudflare.com/ajax/libs/prism/1.23.0/themes/prism.min.css")
    for (let styleSheet of idoc.styleSheets) {
      cssUrls.delete(styleSheet.href)
    }
    for (let url of cssUrls) {
      let l = idoc.head.appendChild(idoc.createElement("link"))
      l.rel = "stylesheet"
      l.href = url
    }

    let jsUrls = new Set()
    jsUrls.add("https://cdnjs.cloudflare.com/ajax/libs/prism/1.23.0/components/prism-core.min.js")
    jsUrls.add("https://cdnjs.cloudflare.com/ajax/libs/prism/1.23.0/plugins/autoloader/prism-autoloader.min.js")
    for (let script of idoc.scripts) {
      if (jsUrls.has(script.src)) {
        jsUrls.delete(script.src)
      } else {
        script.remove()
      }
    }
    for (let url of jsUrls) {
      let s = idoc.head.appendChild(idoc.createElement("script"))
      s.src = url
    }

    return idoc
  }
  
  async load(cat, points) {
    this.cat = cat
    this.points = points
    
    this.baseURI = new URL("content/" + cat + "/" + points + "/", document.baseURI)
    let puzzleURL = new URL("puzzle.json", this.baseURI)

    let doc = this.newDocument()
    let loading = doc.body.appendChild(doc.createElement("div"))
    loading.classList.add("loading")

    try {
      let resp = await this.fetch(puzzleURL)
      if (!resp.ok) {
        softfail(resp)
        let txt = await resp.text()
        this.showErrorAsPuzzle(cat, points, txt)
        return
      }
      let obj = await resp.json()
      this.processPuzzle(cat, points, obj)
    } catch(error) {
      fail(error)
    }
  }

  showErrorAsPuzzle(cat, points, txt) {
    let title = cat + " " + points + ": error!"
    this.contentElement.querySelector("h2").textContent = title
    this.cli.setTitle(title)

    let doc = this.newDocument()
    let errdiv = doc.body.appendChild(doc.createElement("pre"))
    errdiv.textContent = txt
    errdiv.classList.add("error")

    // Make it visible
    this.contentElement.style.display = ""
  }
  
  processPuzzle(cat, points, obj) {
    let title = cat + " " + points
    let scripts = obj.Scripts || []
    let attachments = obj.Attachments || []
    this.contentElement.querySelector("h2").textContent = title
    this.cli.setTitle(title)

    // Let other things examine the object
    this.obj = obj

    // Let's make a new document for our WebView!
    let doc = this.newDocument()
    doc.body.innerHTML = obj.Body

    // Load scripts
    for (let script of scripts) {
      let st = doc.head.appendChild(doc.createElement("script"))
      st.src = new URL(script, doc.baseURI)
    }

    // Now for some metadata
    let metadata = doc.body.appendChild(doc.createElement("div"))
    metadata.classList.add("metadata")

    let files = doc.createElement("div")
    files.classList.add("files")
    let hd = files.appendChild(doc.createElement("h3"))
    hd.textContent = "Attachments"
    let ul = files.appendChild(doc.createElement("ul"))

    for (let fn of attachments) {
      metadata.appendChild(files) // Only show this section if there's a file
      let li = ul.appendChild(doc.createElement("li"))
      let a = li.appendChild(doc.createElement("a"))
      a.href = new URL(fn, doc.baseURI)
      a.innerText = fn
    }

    let authors = metadata.appendChild(doc.createElement("div"))
    authors.classList.add("authors")
    authors.textContent = "Puzzle by " + obj.Authors.join(", ")
    
    // Provide an "answer" field for iframe scripts to set
    let answer = metadata.appendChild(doc.createElement("input"))
    answer.id = "answer"
    answer.name = "answer"
    answer.style.display = "none"
    answer.addEventListener("input", evt => {
      doc.dispatchEvent(new CustomEvent("answer", {detail: {value: evt.target.value}}))
    })

    // If a validation pattern was provided, set that
    let answerElement = this.contentElement.ownerDocument.querySelector("#answer")
    if (obj.AnswerPattern) {
      answerElement.pattern = obj.AnswerPattern
    } else {
      answerElement.removeAttribute("pattern")
    }

    // Populate the Devel box
    this.updateDevelFields(obj)

    // Open links in a new tab
    for (let link of doc.querySelectorAll("a[href]")) {
      link.target = "_blank"
    }

    // Look for stuff to make into workspaces
    let codeBlocks = doc.querySelectorAll("pre code[class^=language-]")
    for (let i=0; i < codeBlocks.length; i++) {
      let codeBlock = codeBlocks[i]
      let language = "unknown"
      let sourceCode = codeBlock.textContent
      for (let c of codeBlock.classList) {
        let parts = c.split("-")
        if ((parts.length == 2) && parts[0].startsWith("lang")) {
          language = parts[1]
        }
      }

      let id = cat + "#" + points + "#" + i
      let element = doc.createElement("div")
      let template = document.querySelector("template#workspace")
      element.classList.add("workspace")
      element.appendChild(template.content.cloneNode(true))
      element.workspace = new Workspace(element, id, sourceCode, language)

      // Now swap it in for the pre
      codeBlock.parentElement.replaceWith(element)

    }
    
    this.setAnswer("")

    // Make it visible
    this.contentElement.style.display = ""

    // We're all done here
    document.dispatchEvent(new Event("puzzleLoad"))
  }
  
  // Populate development box with fields from obj
  updateDevelFields(obj) {
    let fields = document.querySelector("#devel .fields")
    while (fields.firstChild) {
      fields.firstChild.remove()
    }
    let writeObject = function(e, obj) {
      let keys = Object.keys(obj)
      keys.sort()
      for (let key of keys) {
        let val = obj[key]
        if ((key === "Body") || (!val) || (val.length === 0)) {
          continue
        }
        
        let d = e.appendChild(document.createElement("dt"))
        d.textContent = key
        
        let t = e.appendChild(document.createElement("dd"))
        if (Array.isArray(val)) {
          let vi = t.appendChild(document.createElement("ul"))
          vi.multiple = true
          for (let a of val) {
            let opt = vi.appendChild(document.createElement("li"))
            opt.textContent = a
          }
        } else if (typeof(val) === "object") {
          writeObject(t, val)
        } else {
          t.textContent = val
        }
      }
    }
    writeObject(fields, obj)
  }

  // Show information about this puzzle
  showPuzzleInfo(evt) {
    evt.preventDefault()

    removeChildren(this.infoElement)

    if (!this.obj) {
      let p = this.infoElement.appendChild(this.document.createElement("p"))
      p.innerText = "No puzzle is currently loaded."
    } else {
      let el = this.infoElement
      let doc = this.document
      let appendIfSet = function(title, value) {
        if (value) {
          if (value.join) {
            value = value.join(", ")
          }
          el.appendChild(doc.createElement("h2")).textContent = title
          el.appendChild(doc.createElement("p")).textContent = value
        }
      }
      this.infoElement.appendChild(this.document.createElement("h1")).textContent = "🛈 " + this.cat + " " + this.points

      appendIfSet("Authors", this.obj.Authors)
      appendIfSet("Objective", this.obj.Objective)
      appendIfSet("KSAs", this.obj.KSAs)
      appendIfSet("Success: Acceptable", this.obj.Success.Acceptable)
      appendIfSet("Success: Mastery", this.obj.Success.Mastery)
      appendIfSet("Answer Pattern", this.obj.AnswerPattern)
    }
    this.infoElement.showModal()
  }

  // A click happened in the information dialog
  infoClicked(evt) {
    if (evt.target == this.infoElement) {
      this.infoElement.close("cancelled")
    }
  }
    
  // When the user submits an answer
  submit(evt) {
    evt.preventDefault()
    
    let data = new FormData(evt.target)
    data.set("cat", this.cat)
    data.set("points", this.points)
    this.fetch("answer", {
      method: "POST",
      body: data,
    })
    .then(resp => {
      if (resp.ok) {
        resp.json()
        .then(obj => {
          toast(obj.data.description)
          this.cli.updateStateRightNow()
        })
      } else {
        toast("Error submitting your answer. Try again in a few seconds.")
        console.log(resp)
      }
    })
    .catch(err => {
      toast("Error submitting your answer. Try again in a few seconds.")
      console.log(err)
    })
  }
  
  answerEvent(evt) {
    let answer = evt.detail.value
    let answerElement = document.querySelector("#answer")
    answerElement.value = answer
    answerElement.dispatchEvent(new Event("input", {bubbles: true, cancelable: true})) // trigger setAnswer
  }

  setAnswer(e) {
    if (e.detail) {
      this.answerElement.value = e.detail.value
    } else {
      this.answerElement.value = e
    }
    this.answerElement.dispatchEvent(new InputEvent("input"))
  }

  // Check to see if the answer might be correct
  // This might be better done with the "constraint validation API"
  // https://developer.mozilla.org/en-US/docs/Learn/HTML/Forms/Form_validation#Validating_forms_using_JavaScript
 async checkAnswer(evt) {
    let answer = evt.target.value
    let ok = document.querySelector("#answer_ok")
    
    // The theme has to provide someplace to put the check
    if (! ok) {
      return
    }
    
    ok.textContent = "❌"
    ok.title = "Wrong"
    let answerHash = await SHA256Hash(answer)
    for (let correctHash of (this.obj.AnswerHashes || [])) {
      if (correctHash == answerHash) {
        ok.textContent = "⭕"
        ok.title = "Maybe right"
      }
    }
  }
}
