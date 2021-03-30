function mothFetch(location) {
    let url = new URL(location, window.location)
    url.searchParams.set("id", localStorage.id)
    url.searchParams.set("pid", localStorage.pid)
    return fetch(url)
}

async function addPuzzle(cat, points) {
    let resp = await mothFetch(`../content/${cat}/${points}/puzzle.json`)
    let puzzle = await resp.json()

    let tbody = document.querySelector("tbody")
    let tr = tbody.appendChild(document.createElement("tr"))
    tr.appendChild(document.createElement("td")).textContent = cat
    tr.appendChild(document.createElement("td")).textContent = points
    tr.appendChild(document.createElement("td")).textContent = puzzle.Objective || "-"
    tr.appendChild(document.createElement("td")).textContent = puzzle.Success.Acceptable || "-"
    tr.appendChild(document.createElement("td")).textContent = puzzle.Success.Mastery || "-"
    tr.appendChild(document.createElement("td")).textContent = (puzzle.KSAs || []).join(", ") || "-"
}

async function appInit() {
    let resp = await mothFetch("../state")
    let obj = await resp.json()

    for (let event of obj.PointsLog) {
        if (event[1] == "self") {
            addPuzzle(event[2], event[3])
        }
    }
    console.log(obj)
}

if (window.navigator.userAgent.match(/MSIE|Trident/)) {
    // I can't believe it's 2021 and I still need this
    window.location = "https://www.engadget.com/2019-02-08-microsoft-internet-explorer-technical-debt.html"
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appInit)
  } else {
    appInit()
  }
  