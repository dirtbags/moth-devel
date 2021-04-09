// jshint asi:true

function sortNumber(a, b) {
  return a - b;
}
function sortNumberPairFirst(a, b) {
  return a[0] - b[0];
}
function sortNumberPairSecond(a, b) {
  return a[1] - b[1];
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
  
  function update(state) {
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
	for (let [key, value] of Object.entries(categories)) {
		let titleRow = document.createElement("div")
		
		titleRow.textContent = key
		titleRow.style.width = maxWidth + "%"
		titleRow.classList.add("cat" + catID)
		titleRow.style.width = maxWidth + "%"
		titleRow.classList.add("cat" + catID)
		element.appendChild(titleRow)
		
		let categoryProblemSolves = numProblemSolves[key]
		let problems = []
		let maxNumChars = 0
		let sortby = "problemnumber"
		if("sortby" in urlParameters)
		{
			sortby = urlParameters["sortby"];
		}
		/*
		if(sortby == "problemnumber"){
			for (let [key, value] of Object.entries(categoryProblemSolves)) {
				problems.push(key)
				if(key.toString().length > maxNumChars){
					maxNumChars = key.toString().length
				}
			}
			problems = problems.sort(sortNumber)
			for(pointValue in problems){
				let problemRow = document.createElement("div")
				//console.log(categoryProblemSolves[problems[pointValue]])
				let starString = "*"
				let spaceString = '\xa0'
				let numSpaces = maxNumChars - problems[pointValue].toString().length
				
				problemRow.textContent = problems[pointValue] + spaceString.repeat(numSpaces + 1) + starString.repeat(categoryProblemSolves[problems[pointValue]])
				problemRow.style.width = maxWidth + "%"
				problemRow.classList.add("cat" + catID)
				problemRow.style.width = maxWidth + "%"
				problemRow.classList.add("cat" + catID)
				problemRow.style.fontFamily = "Courier"
				element.appendChild(problemRow)
			}
		}
		else if(sortby == "numanswered"){
			for (let [key, value] of Object.entries(categoryProblemSolves)) {
				problems.push([key, value])
				if(key.toString().length > maxNumChars){
					maxNumChars = key.toString().length
				}
			}
			problems = problems.sort(sortNumberPairFirst)
			for(pointValue in problems){
				let problemRow = document.createElement("div")
				//console.log(categoryProblemSolves[problems[pointValue]])
				let starString = "*"
				let spaceString = '\xa0'
				let numSpaces = maxNumChars - problems[pointValue][0].toString().length
				
				problemRow.textContent = problems[pointValue][0] + spaceString.repeat(numSpaces + 1) + starString.repeat(categoryProblemSolves[problems[pointValue][0]])
				problemRow.style.width = maxWidth + "%"
				problemRow.classList.add("cat" + catID)
				problemRow.style.width = maxWidth + "%"
				problemRow.classList.add("cat" + catID)
				problemRow.style.fontFamily = "Courier"
				element.appendChild(problemRow)
			}
		}
		*/
		for (let [key, value] of Object.entries(categoryProblemSolves)) {
			problems.push([key, value])
			if(key.toString().length > maxNumChars){
				maxNumChars = key.toString().length
			}
		}
		if(sortby == "problemnumber"){
			problems = problems.sort(sortNumberPairFirst)
		}
		else if(sortby == "numanswered"){
			problems = problems.sort(sortNumberPairSecond)
		}
		for(pointValue in problems){
			let problemRow = document.createElement("div")
			//console.log(categoryProblemSolves[problems[pointValue]])
			let starString = "*"
			let spaceString = '\xa0'
			let numSpaces = maxNumChars - problems[pointValue][0].toString().length
			
			problemRow.textContent = problems[pointValue][0] + spaceString.repeat(numSpaces + 1) + starString.repeat(categoryProblemSolves[problems[pointValue][0]])
			problemRow.style.width = maxWidth + "%"
			problemRow.classList.add("cat" + catID)
			problemRow.style.width = maxWidth + "%"
			problemRow.classList.add("cat" + catID)
			problemRow.style.fontFamily = "Courier"
			element.appendChild(problemRow)
		}
		catID++;
	}
	
    
    

  }
  
  function refresh() {
    fetch("../state")
    .then(resp => {
      return resp.json()
    })
    .then(obj => {
      update(obj)
    })
    .catch(err => {
      console.log(err)
    })
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
