// jshint asi:true

function sortNumber(a, b) {
  return a - b;
}

function getUrlVars()
{
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
		if(key in vars) {
			let curEntry = vars[key]
			if(Array.isArray(curEntry)) {
				curEntry.push(value)
				vars[key] = curEntry
			}
			else {
				let arrayToInsert = []
				arrayToInsert.push(curEntry)
				arrayToInsert.push(value)
				vars[key] = arrayToInsert
			}
		}
		else {
			vars[key] = value;
		}
    });
    return vars;
}

let teamsFaded = false;
function fadeTeams(){
	if(teamsFaded == false){
		document.querySelectorAll(".teamrow").forEach(a=>a.style.opacity = "0")
		document.querySelectorAll(".teamrow").forEach(
			a=>a.style.transform = "translate(0, " + (a.elemNum * (-100)) + "%)"
		)
		document.querySelectorAll(".titlerow").forEach(
			a=>a.style.transform = "translate(0, " + (((a.elemNum)) * (-85)) + "%)"
		)
		document.querySelectorAll(".percentrow").forEach(
			a=>a.style.transform = "translate(0, " + (((a.elemNum)) * (-85)) + "%)"
		)
		//document.querySelectorAll(".teamrow").forEach(a=>a.style.display = "none")
		teamsFaded = true
	}
	else{
		document.querySelectorAll(".teamrow").forEach(a=>a.style.opacity = "1");
		document.querySelectorAll(".teamrow").forEach(a=>a.style.transform = "translate(0, 0)")
		document.querySelectorAll(".titlerow").forEach(a=>a.style.transform = "translate(0, 0)")
		document.querySelectorAll(".percentrow").forEach(a=>a.style.transform = "translate(0, 0)")
		//document.querySelectorAll(".teamrow").forEach(a=>a.style.display = "inline-block")
		teamsFaded = false
	}
}

function scoreboardInit() {
  
  chartColors = [
    "rgb(255, 99, 132)",
    "rgb(255, 159, 64)",
    "rgb(255, 205, 86)",
    "rgb(75, 192, 192)",
    "rgb(54, 162, 235)",
    "rgb(153, 102, 255)",
    "rgb(201, 203, 207)"
  ]
  
  async function refresh() {
    let resp = await fetch("../state")
    let state = await resp.json()

	for (let rotate of document.querySelectorAll(".rotate")) {
      rotate.appendChild(rotate.firstElementChild)
    }
	
	let urlParameters = getUrlVars()
    
    let element = document.getElementById("rankings")
    let teamNames = state.TeamNames
    let pointsLog = state.PointsLog
  
    // Every machine that's displaying the scoreboard helpfully stores the last 20 values of
    // points.json for us, in case of catastrophe. Thanks, y'all!
    //
    // We have been doing some variation on this "everybody backs up the server state" trick since 2009.
    // We have needed it 0 times.
    let pointsHistory = JSON.parse(localStorage.getItem("pointsHistory")) || []
    if (pointsHistory.length >= 20) {
      pointsHistory.shift()
    }
    pointsHistory.push(pointsLog)
    localStorage.setItem("pointsHistory", JSON.stringify(pointsHistory))
	
	let teams = {}
    let categoryScores = {}
  
    // Initialize data structures
    for (let teamId in teamNames) {
        teams[teamId] = {
        categoryScore: {},        // map[string]int
        overallScore: 0,          // int
        historyLine: [],          // []{x: int, y: int}
        name: teamNames[teamId],
        id: teamId
      }
    }
	
	let selectedCategories = []
	if("categories" in urlParameters){
		selectedCategories = urlParameters["categories"]
		if(!(Array.isArray(selectedCategories))){
			let tmpArray = []
			tmpArray.push(selectedCategories)
			selectedCategories = tmpArray
		}
	}
	
	let categories = {}
	let maxCategoryAnswers = {}
	let numProblemSolves = {}
	
	// Let's find the categories
	for (let entry of pointsLog) {
		let category = entry[2]
		if(!(selectedCategories.length) || selectedCategories.includes(category)){
			let teamId = entry[1]
			let points = entry[3]
			categories[category] = {}
			numProblemSolves[category] = {}
			categoryScores[category] = []
		}
		
	}
	for (let entry of pointsLog) {
		let category = entry[2]
		if(!(selectedCategories.length) || selectedCategories.includes(category)){
			let teamId = entry[1]
			let points = entry[3]
			numProblemSolves[category][points] = 0
			categories[category][teamId] = []
		}
	}
	for (let entry of pointsLog) {
		let category = entry[2]
		if(!(selectedCategories.length) || selectedCategories.includes(category)){
			let teamId = entry[1]
			let points = entry[3]
			numProblemSolves[category][points]++
			categories[category][teamId].push(points)
		}
	}
	
	// Make sure that the point values are sorted in asc order
	for (let [key, value] of Object.entries(categories)) {
		for (let [k, v] of Object.entries(value)) {
			v = v.sort(sortNumber)
			value[k] = v
			for(let pointVal in v){
				if(!(categoryScores[key].includes(v[pointVal]))){
					categoryScores[key].push(v[pointVal])
					categoryScores[key] = categoryScores[key].sort(sortNumber)
				}
			}
		}
	}
	
  
    // Clear out the element we're about to populate
    Array.from(element.childNodes).map(e => e.remove())
  
    let maxWidth = 100
	
	let catID = 0;
	let masterRows = 0
	for (let [key, value] of Object.entries(categories)) {
		let titleRow = document.createElement("div")
		
		//titleRow.textContent = key
		titleRow.style.width = maxWidth + "%"
		titleRow.classList.add("cat" + catID)
		titleRow.style.width = maxWidth + "%"
		titleRow.classList.add("cat" + catID)
		titleRow.addEventListener("click",
					function(d){
						fadeTeams()
					});
		titleRow.style.cursor = "pointer"
		titleRow.elemNum = masterRows
		titleRow.classList.add("titlerow")
		let titleSpan = document.createElement("span")
		titleSpan.textContent = key
		titleRow.appendChild(titleSpan)
		element.appendChild(titleRow)
		
		let pointWidth = 100 / (categoryScores[key].length)
		let row = document.createElement("div")
		let categoryProblemSolves = numProblemSolves[key]
		let problems = []
		for (let [key, value] of Object.entries(categoryProblemSolves)) {
			problems.push(key)
		}
		problems = problems.sort(sortNumber)
		for(pointValue in problems){
			percentDone = categoryProblemSolves[problems[pointValue]] / Object.entries(teamNames).length
			let completionBar = document.createElement("span")
			completionBar.textContent = Math.round(percentDone * 100) + "%"
			completionBar.style.width = pointWidth * percentDone + "%"
			completionBar.style.color = "black"
			completionBar.style.backgroundColor = "white"
			row.appendChild(completionBar)
			let incompletionBar = document.createElement("span")
			incompletionBar.textContent = Math.round((1 - percentDone) * 100) + "%"
			incompletionBar.style.width = pointWidth * (1 - percentDone) + "%"
			incompletionBar.style.color = "white"
			incompletionBar.style.backgroundColor = "black"
			row.appendChild(incompletionBar)
			
		}
		row.style.width = maxWidth + "%"
		row.classList.add("cat" + catID)
		row.addEventListener("click",
					function(d){
						fadeTeams()
					});
		row.style.cursor = "pointer"
		row.elemNum = masterRows
		row.classList.add("percentrow")
		element.appendChild(row)
		masterRows++;
		masterRows++;
		let nestedID = 0
		for (let [k, v] of Object.entries(value)) {
			let nestedRow = document.createElement("div")
			nestedRow.style.width = maxWidth + "%"
			nestedRow.classList.add("cat" + catID)
			for(let pointVal of categoryScores[key]){
				let nestedBar = document.createElement("span")
				if(v.includes(pointVal)){
					nestedBar.style.color = "black"
					nestedBar.textContent = pointVal
				}
				else{
					nestedBar.style.backgroundColor = "black"
					nestedBar.style.color = "white"
					nestedBar.textContent = pointVal
				}
				nestedBar.style.width = pointWidth + "%"
				nestedBar.classList.add("teamrow")
				nestedRow.appendChild(nestedBar)
			}
			let te = document.createElement("span")
			te.classList.add("teamname")
			te.textContent = teamNames[k]
			nestedRow.appendChild(te)
			nestedRow.elemNum = nestedID
			nestedRow.classList.add("teamrow")
			if(teamsFaded == true){
				document.querySelectorAll(".teamrow").forEach(a=>a.style.opacity = "0")
				document.querySelectorAll(".teamrow").forEach(
					a=>a.style.transform = "translate(0, " + (a.elemNum * (-100)) + "%)"
				)
				document.querySelectorAll(".titlerow").forEach(
					a=>a.style.transform = "translate(0, " + (((a.elemNum)) * (-85)) + "%)"
				)
				document.querySelectorAll(".percentrow").forEach(
					a=>a.style.transform = "translate(0, " + (((a.elemNum)) * (-85)) + "%)"
				)
			}
			else{
				document.querySelectorAll(".teamrow").forEach(a=>a.style.opacity = "1");
				document.querySelectorAll(".teamrow").forEach(a=>a.style.transform = "translate(0, 0)")
				document.querySelectorAll(".titlerow").forEach(a=>a.style.transform = "translate(0, 0)")
				document.querySelectorAll(".percentrow").forEach(a=>a.style.transform = "translate(0, 0)")
			}
			document.querySelectorAll(".teamrow").forEach(a=>a.style.transition = "all .5s")
			document.querySelectorAll(".titlerow").forEach(a=>a.style.transition = "all .5s")
			document.querySelectorAll(".percentrow").forEach(a=>a.style.transition = "all .5s")
			element.appendChild(nestedRow)
			masterRows++;
			nestedID++
		}
		catID++;
	}
	
    
    

  }
  
  function init() {
    let base = window.location.href.replace("scoreboard.html", "")
    let location = document.querySelector("#location")
    if (location) {
      location.textContent = base
    }
  
    setInterval(refresh, 60000)
    refresh()
  }
  
  init()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scoreboardInit)
} else {
  scoreboardInit()
}
