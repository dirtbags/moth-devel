// jshint asi:true

import {toast, fail, softfail, uuidv4, removeChildren} from "./common.mjs"
import {Puzzle} from "./puzzle.mjs"

/**
 * This is the ratio of the circumference of a circle to its radius.
 */
const TAU = Math.PI * 2

class MothClient {
  constructor() {
    this.nextHeartbeat = 0
    this.heartbeatInterval = 20000 // ms between state fetches
    this.pacemaker = setInterval(() => this.updatePacemaker(), 1000 / 2) // 2 fps ought to be good enough

    document.querySelector("#login").addEventListener("submit", evt => this.login(evt))
    this.puzzle = new Puzzle(document.querySelector("#content"), this)
    document.querySelectorAll("button.fullscreen").forEach(e => this.fullscreenInit(e))
    this.init()
  }
  
  /**
   * Initialize the UI.
   * 
   * This can be called more than once, which is why it's not part of the constructor.
   * For instance, after logout, we want to re-init the UI without reloading everything.
   */
  init() {
    // Make everything go away, we'll only turn on the things we want
    document.querySelectorAll("#app > *").forEach(e => {
      e.style.display = "none"
    })
    
    // We always want messages and toasts
    document.querySelector("#messages").style.display = ""
    document.querySelector("#toasts").style.display = ""

    // Back button can load a new puzzle
    window.addEventListener("popstate", e => this.loadPuzzle(e))

    for (let element of document.querySelectorAll(".logout")) {
      element.addEventListener("click", e => this.logout(e))
    }
    
    if (! localStorage.pid) {
      localStorage.pid = uuidv4()
    }

    if (localStorage.id) {
      // Already signed in
      document.querySelector("#puzzles").style.display = ""
      document.querySelector("#messages").innerHTML = ""
      this.loadPuzzle()
    } else {
      document.querySelector("#login").style.display = ""
      document.querySelector("#messages").innerHTML = "<h1>Monarch of the Hill server</h1>"
    }

    // Do we want text in the pid field to mirror into the id field?
    let pidInput = document.querySelector("[name=pid]")
    if (pidInput) {
      let propogate = pidInput.dataset.propogate

      if (["true", "yes", "enabled", "propogate"].includes(propogate)) {
        pidInput.addEventListener("input", e => this.pidInput(e))
      }
    }

    // If the URL specifies values, fill those in
    let urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has("pid")) {
      pidInput.value = urlParams.get("pid")
    }
    if (urlParams.has("id")) {
      document.querySelector("[name=id]").value = urlParams.get("id")
    }
    if (urlParams.has("name")) {
      document.querySelector("[name=name]").value = urlParams.get("name")
    }

    this.updateStateRightNow()
  }

  fetch(url, args={}) {
    if (! url.searchParams) {
      url = new URL(url, window.location)
    }
    if (localStorage.id) {
      url.searchParams.set("id", localStorage.id)
    }
    url.searchParams.set("pid", localStorage.pid)
    return fetch(url, args)
  }
  
  setTitle(title) {
    let fullTitle = "MOTH"
    if (title) {
      fullTitle = fullTitle + ": " + title
    }
    document.title = fullTitle
  }
  
  renderNotices(obj) {
    let ne = document.getElementById("notices")
    if (ne) {
      ne.innerHTML = obj
    }
  }
  
  /** loadPuzzle tries a few techniques to load a puzzle.
   * 
   * You can call it from various event handlers,
   * or directly to parse the URL.
   */
  loadPuzzle(evt) {
    let cat, points, push = true
    switch (evt && evt.type) {
      case "click":
        cat = evt.target.dataset.cat
        points = evt.target.dataset.points
        break
      case "popstate":
        push = false
        cat = evt.state.cat
        points = evt.state.points
        break
      default: // Go by URL
        let parts = location.hash.split("#")
        if (parts.length == 1) {
          // They're not asking to load a puzzle with this URL
          return
        }
        if (parts.length == 3) {
          cat = parts[1]
          points = parts[2]
        }
        break
    }

    if (cat && points) {
      if (push) {
        history.pushState(
          {cat: cat, points: points}, 
          cat + " " + points, 
          "#" + cat + "#" + points,
        )
      }
      this.puzzle.load(cat, points)
    } else {
      toast("I can't figure out which puzzle to load!")
    }

    this.highlightCurrentPuzzle(true)
  }

  /** highlightCurrentPuzzle figures out what the currently-displayed puzzle is, and highlights it.
   * 
   * It also scrolls it into view if this.scrollIntoView is set.
   */
  highlightCurrentPuzzle(scrollIntoView) {
    if (scrollIntoView) {
      // Stash this away, in case we don't use it right now.
      // This might happen if the points haven't been rendered yet.
      this.scrollIntoView = scrollIntoView
    }
    for (let e of document.querySelectorAll("[data-points].current")) {
      e.classList.remove("current")
    }
    for (let e of document.querySelectorAll("[data-category='" + this.puzzle.cat + "'] [data-points='" + this.puzzle.points + "']")) {
      e.classList.add("current")
      if (this.scrollIntoView) {
        e.scrollIntoView({block: "nearest"})
        this.scrollIntoView = false
      }
    }

  }
  
  updateState(obj) {
    let config = obj.Config
    let messages = obj.Messages
    let puzzles = obj.Puzzles
    
    if (config.Devel) {
      // We are in development mode
      let nameInput = document.querySelector("[name=name]")
      let pidInput = document.querySelector("[name=pid]")
      let idInput = document.querySelector("[name=id]")
      let develFields = document.querySelector("#devel .fields")
      nameInput.value = nameInput.value || "Rodney"
      pidInput.value = pidInput.value || "DevelPid"
      idInput.value = idInput.value || "DevelId"
      document.querySelector("#devel").style.display = ""
    }
    
    // Display messages
    let messagesElement = document.querySelector("#messages")
    if (messagesElement && messages) {
      messagesElement.innerHTML = messages
    }
    
    // Create a sorted list of category names
    let puzzlesList = document.createElement("div")
    let cats = Object.keys(puzzles)
    cats.sort()
    for (let cat of cats) {
      let catPuzzles = puzzles[cat]
      
      let pdiv = puzzlesList.appendChild(document.createElement('div'))
      pdiv.dataset.category = cat
      
      let h = pdiv.appendChild(document.createElement('h2'))
      h.textContent = cat
      if (config.Devel) {
        let a = h.appendChild(document.createElement('a'))
        a.appendChild(document.createElement("img")).src = "images/luna-moth.svg"
        a.href = "mothballer/" + cat + ".mb"
        a.classList.add("mothball")
        a.title = "Download a mothball for this category"
      }
      
      // List out puzzles in this category
      let l = pdiv.appendChild(document.createElement('ul'))
      for (let points of catPuzzles) {
    
        let i = l.appendChild(document.createElement('li'))

        if (points === 0) {
          // Sentry: there are no more puzzles in this category
          i.textContent = "❖"
          i.classList.add("sentry")
          i.title = "no more puzzles"
        } else {
          i.dataset.points = points
          let a = i.appendChild(document.createElement('a'))
          a.classList.add("puzzle")
          a.dataset.cat = cat
          a.dataset.points = points
          a.title = cat + " " + points
          a.textContent = points
          a.addEventListener("click", e => this.loadPuzzle(e))
        }
      }
    }

    // Drop puzzle list into puzzles element.
    // We do this at the very end just in case something crashes, 
    // so we can still have a puzzle list displayed for the user if something goes wrong.
    let container = document.querySelector("#puzzleslist")
    removeChildren(container)
    container.appendChild(puzzlesList)
    this.highlightCurrentPuzzle()
  }
  
  /**
   * Go fetch a new state right now.
   */
  updateStateRightNow() {
    this.nextHeartbeat = 0
  }
  
  /**
   * Update the little countdown timer. If heartbeatInterval has passed, fetch state.
   */
  updatePacemaker() {
    let now = Date.now()
    let timeLeft = Math.max(this.nextHeartbeat - now, 0)

    // First, update the little indicator doodad
    let canvas = document.querySelector("#updatetimer")
    if (canvas) {
      let w = canvas.width/2
      let h = canvas.height/2
      let angle = TAU * (timeLeft / this.heartbeatInterval)
      let r = Math.min(w, h)

      let ctx = canvas.getContext("2d")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
      ctx.beginPath()
      ctx.moveTo(w, h)
      ctx.arc(w, h, r, TAU*0.75 - angle, TAU*0.75)
      ctx.lineTo(w, h)
      ctx.fill()
    }

    // If there's still time remaining before the next heartbeat, we're all done
    if (timeLeft > 0) {
      return
    }
    this.nextHeartbeat = now + this.heartbeatInterval
    
    let data = new FormData()
    data.set("id", localStorage.id)
    data.set("pid", localStorage.pid)
    let stateUrl = new URL("state", window.location)
    this.fetch(stateUrl)
    .then(resp => {
      if (resp.ok) {
        resp.json()
        .then(obj => this.updateState(obj))
        .catch(softfail)
      } else {
        softfail(resp)
      }
    })
    .catch(softfail)
  }
 
  login(evt) {
    let form = document.querySelector("#login")
    if (evt) {
      evt.preventDefault()
    }
    let data = new FormData(form)
    let id = data.get("id")
    let pid = data.get("pid")
  
    this.fetch("register", {
      method: "POST",
      body: data,
    })
    .then(resp => {
      if (resp.ok) {
        resp.json()
        .then(obj => {
          if ((obj.status == "success") || (obj.data.short == "Already registered")) {
            localStorage.id = id
            localStorage.pid = pid
            toast("Logged in")
            this.init()
          } else {
            toast(obj.data.description)
          }
        })
        .catch(fail)
      } else {
        fail(resp)
      }
    })
    .catch(fail)
  }
  
  logout(evt) {
    if (evt) {
      evt.preventDefault()
    }
    localStorage.removeItem("id")
    localStorage.removeItem("pid")
    removeChildren(document.querySelector("#devel .fields"))
    this.puzzle.newDocument()
    toast("Logged out")
    this.init()
  }
  
  fullscreen(evt) {
    evt.target.parentElement.classList.toggle("fullscreen")
  }
  
  fullscreenInit(el) {
    el.title = "Full Screen"
    el.addEventListener("click", evt => this.fullscreen(evt))
  }

  pidInput(evt) {
    let e = evt.target
  
    document.querySelector("[name=id]").value = e.value
  }
}


function appInit(evt) {
  window.app = new MothClient()
}

if (window.navigator.userAgent.match(/MSIE|Trident/)) {
  // I can't believe it's 2021 and I still need this
  window.location = "https://www.engadget.com/2019-02-08-microsoft-internet-explorer-technical-debt.html"
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", appInit)
} else {
  appInit()
}
