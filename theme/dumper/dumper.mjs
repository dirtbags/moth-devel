import { Puzzle } from "../scripts/puzzle.mjs"

function mothFetch(location) {
    let url = new URL(location, window.location)
    url.searchParams.set("id", localStorage.id)
    url.searchParams.set("pid", localStorage.pid)
    return fetch(url)
}

async function listCategories(state ) {
    let ul = document.querySelector("#categories")
    for (let cat of Object.keys(state.Puzzles)) {
        let li = ul.appendChild(document.createElement("li"))
        let a = li.appendChild(document.createElement("a"))

        a.href = `?cat=${cat}`
        a.textContent = cat
    }
}

async function dumpCategory(state, cat) {
    let pointsList = state.Puzzles[cat]
    let div = document.body.appendChild(document.createElement("div"))
    div.classList.add("category")

    div.appendChild(document.createElement("h2")).textContent = cat

    for (let points of pointsList) {
        if (points == 0) {
            // 0 means you've unlocked everything in the category
            continue
        }
        let baseURL = new URL(`../content/${cat}/${points}/`, window.location)
        let resp = await mothFetch(new URL("puzzle.json", baseURL))
        let puzzle = await resp.json()

        let puzzleDiv = div.appendChild(document.createElement("div"))
        puzzleDiv.classList.add("puzzle")

        let puzzleTitle = puzzleDiv.appendChild(document.createElement("h3"))
        puzzleTitle.classList.add("points")
        puzzleTitle.textContent = `${points} point puzzle`
        
        let body = puzzleDiv.appendChild(document.createElement("div"))
        body.classList.add("body")
        body.innerHTML = puzzle.Body
        for (let img of body.querySelectorAll("img")) {
            // URLs are absolute at this point. 
            // We're going to assume for now that no puzzle has subdirectories.
            let filename = img.src.split("/").pop()
            let imgURL = new URL(filename, baseURL)
            img.src = imgURL
        }

        let fields = puzzleDiv.appendChild(document.createElement("dl"))
        fields.classList.add("fields")

        let writeObject = function(e, obj) {
            let keys = Object.keys(obj)
            keys.sort()
            for (let key of keys) {
                let val = obj[key]
                if ((key == "Body") || (!val) || (val.length === 0)) {
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
        writeObject(fields, puzzle)
    }
}


async function appInit() {
    let params = new URLSearchParams(window.location.search)
    let cats = params.getAll("cat")

    let resp = await mothFetch("../state")
    let state = await resp.json()

    if (cats.length == 0) {
        listCategories(state)
    }
    for (let cat of cats) {
        dumpCategory(state, cat)
    }

    let title = params.get("title")
    if (title) {
        document.querySelector("h1").textContent = title
    }
    
    for (let p of document.querySelectorAll("button.print")) {
        p.addEventListener("click", () => window.print())
    }
}

if (window.navigator.userAgent.match(/MSIE|Trident/)) {
    // I can't believe it's 2021 and I still need this
    window.location = "https://www.engadget.com/2019-02-08-microsoft-internet-explorer-technical-debt.html"
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appInit)
} else {
    appInit()
}
