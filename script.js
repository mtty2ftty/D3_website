// Responsive sizing based on the chart pane + viewport
function getChartSize() {
  const pane = document.querySelector('.chart-pane');
  const rect = pane ? pane.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  // Square that fits inside the pane, capped at 90% of viewport height
  return Math.max(320, Math.floor(Math.min(rect.width, window.innerHeight * 0.9)));
}

let width = getChartSize();
let height = width;
let radius = width / 7;

const radiusOuterScale = 0.1;
const threshVal = 5;

// Re-render on resize (simple + reliable for this demo)
let __resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(__resizeTimer);
  __resizeTimer = setTimeout(() => window.location.reload(), 200);
});
// Load the CSV file
fetch(
  'https://raw.githubusercontent.com/mtty2ftty/D3_website/refs/heads/main/dummyHierarchyComplexFilled.csv',
)
  .then((response) => response.text())
  .then((text) => {
    const data = d3.csvParse(text);

// Function to find or create a node
function getNode(parent, name) {
  if (!parent.children) {
    parent.children = [];
  }
  // Check and Avoid Duplicate Node Creation
  let node = parent.children.find((child) => child.name === name);
  if (!node) {
    node = { name, children: [], scores: {}, value: undefined };
    parent.children.push(node);
  }
  return node;
}

// Initialize the root node
const rootNodeName = 'NHS'; // Change this variable to use a different root node
let rootCol;
// Initialize the root node
const rootNode = { name: rootNodeName, children: [], scores: {}, value: undefined };
//const rootCol = 1
// Function to find the root node in the data
function findRootNode(data, rootName) {
    const rootRow = data.find(row => {
        for (let i = 0; i <= 10; i++) {
            if (row[`Level${i}`] === rootName) {
                rootCol = i;
                return true;
            }
        }
        return false;
    });

    if (!rootRow) {
        console.warn(rootName + ' not found in any hierarchy level');
        return null;
    }

    const newRoot = { name: rootName, children: [], scores: {}, value: undefined };
    Object.keys(rootRow)
        .filter(k => k.startsWith('Score'))
        .forEach(k => {
            newRoot.scores[k] = +rootRow[k] || 0;
        });
    return newRoot;
}

// In the data processing section
const rootFromData = findRootNode(data, rootNodeName);

if (rootFromData) {
    rootNode.name = rootFromData.name;
    rootNode.scores = rootFromData.scores;
    // Continue with tree building logic
}


//// Process the company scores directly from the first row
//const firstRow = data[0];
//Object.keys(firstRow)
//  .filter((k) => k.startsWith('Score'))
//  .forEach((k) => {
//    rootNode.scores[k] = +firstRow[k] || 0;
//  });
  
// Processing each data row
let nowNode = rootNode;
data.forEach((row) => {
  const isRelevant = (rootNodeName === row[`Level${rootCol}`]); // Added check for relevant rows
  let currentNode = rootNode;

  if (isRelevant) { // Building branches only if relevant
    for (let i = rootCol+1; i <= 10 && isRelevant; i++) { 
      const levelName = row[`Level${i}`];
      if (levelName && levelName.trim()) {
        currentNode = getNode(currentNode, levelName);
      } else {
        break; // Terminate if no more meaningful levels
      }
    }
    
    // Assign scores and values correctly
    Object.keys(row)
      .filter((k) => k.startsWith('Score'))
      .forEach((k) => {
        currentNode.scores[k] = +row[k] || 0; // Scores applied to the accurate node
      });

    if (row['size'] && row['size'].trim() !== '') {
      currentNode.value = +row['size']; 
    }
  }

});



function removeValuesFromParents(node) {
  if (node.children && node.children.length > 0) {
    node.value = undefined;
    node.children.forEach(removeValuesFromParents);
  }
}

removeValuesFromParents(rootNode);

        
    const colors = 
    [
        "#71769c", // <50
        "#a0a4bd", // 50-59
        "#a5dfde", // 60-69
        "#1dafad"  // >=70
    ];
    const labels = [
      'Scores below 50',
      'Scores 50-60',
      'Scores 60-70',
      'Scores above 70',
      'Redacted',
    ];

// Render legend into the chart overlay (top-left of chart pane)
(function renderOverlayLegend() {
  const legendEl = document.getElementById('chartLegend');
  if (!legendEl) return;

  const items = colors.map((c, i) => ({ color: c, label: labels[i] })).filter(d => d.label);
  legendEl.innerHTML = items.map(d =>
    `<div class="chart-legend-item">
       <span class="chart-legend-swatch" style="background:${d.color}"></span>
       <span class="chart-legend-label">${d.label}</span>
     </div>`
  ).join('');
})();

    const colorScale = d3
      .scaleThreshold()
      .domain([50, 60, 70, 100])
      .range([colors[0], colors[1], colors[2], colors[3]]);
    //console.log(rootNode)

    //const hierarchy = d3.hierarchy(rootNode);
    //hierarchy.eachAfter((n) => aggregateUniqueValues(n));
   
    // Use 'uniqueValue' to define segment sizes
    //hierarchy.sum((d) => d.data.scores['uniqueValue'] || 0);

    const hierarchy = d3.hierarchy(rootNode).sum((d) => d.value|| 0 )
    //.sort((a, b) => (b.scores['value'] || 0) - (a.scores['value'] || 0));

    console.log(rootNode);

    const root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(
      hierarchy,
    );
    root.each((d) => (d.current = d));

    const rootPartition = d3
      .partition()
      .size([2 * Math.PI, hierarchy.height + 1])(hierarchy);

    rootPartition.each((d) => (d.current = d));

    const maxDepth = d3.max(rootPartition.descendants(), (d) => d.depth);
    const hiddenLevels = maxDepth - 2;

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d) =>
        d.y0 <= 3
          ? d.y0 * radius
          : (3 + (d.y0 - 3) * radiusOuterScale) * radius,
      )
      .outerRadius((d) =>
        d.y1 <= 3
          ? d.y1 * radius
          : (3 + (d.y1 - 3) * radiusOuterScale) * radius,
      );

    const svg = d3
      .select('#chart')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      // Scale SVG typography with the rendered chart size (labels stay proportional)
      .style('font-size', `${(14 * (width / 1000)).toFixed(2)}px`)
      .style('overflow', 'hidden')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)
      .style('font', '10px sans-serif');

    const centerCircle = svg
      .append('circle')
      .attr('r', radius)
      .attr('fill', colorScale(root.data.scores.Score1 || 0));

    const path = svg
      .append('g')
      .selectAll('path')
      .data(rootPartition.descendants())
      .join('path')
      .attr('fill-opacity', (d) => Math.max(0, 1 - d.depth * 0.1))
      .attr('fill', (d) =>
        d.data.scores.value < 5
          ? colors[4]
          : colorScale(d.data.scores.Score1 || 0),
      )
      .attr('pointer-events', (d) => (arcVisible(d.current) ? 'auto' : 'none'))
      .attr('d', (d) => arc(d.current));

    path
      .filter((d) => d.children)
      .style('cursor', 'pointer')
      .on('click', clicked);

    const format = d3.format(',d');
    path.append('title').text(
      (d) =>
        `${d
          .ancestors()
          .map((d) => d.data.name)
          .reverse()
          .join('/')}\n${format(d.value)}`,
    );

    const centerText = svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('fill', 'black')
      .text(`${root.data.name}: ${root.data.scores.Score1 || 0}%`);

    const label = svg
      .append('g')
      .attr('id', 'scoresLabels')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(rootPartition.descendants())
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill-opacity', (d) => +labelVisible(d.current))
      .attr('transform', (d) => labelTransform(d.current))
      .text((d) =>
        d.data.scores.value > threshVal
          ? `${d.data.name}: ${d.data.scores.Score1 || 0}%`
          : `${d.data.name}: Redacted`,
      );

    const parent = svg
      .append('circle')
      .datum(root)
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('click', clicked);
      document.getElementById('resetButton').addEventListener('click', () => {
        console.log(root)
        clicked(null,root,d3.select('#scoreSelector').property('value')); 
        updateCurrentLevelsText(root);
        //centerText.text(`${root.name}: ${root.scores['Score1'] || 0}%`);
        });
    // Function to find a node by name
    function findNodeByName(name) {
      return root.descendants().find((d) => d.data.name === name);
    }    
    
    function cardNavigation(event){
      const idx = Array.from(document.querySelectorAll('.info-card')).findIndex(c => c.classList.contains('active'));
      console.log('Current card index:', idx);
      if([1,2,3,4].includes(idx)){ // Prevent action if already on the first card
        const storyStates = [{storyNodeName: "Region1",storyScore: 'Score1'},
                             {storyNodeName: "NHS England",storyScore: 'Score2'},
                             {storyNodeName: "Region3",storyScore: 'Score3'},
                             {storyNodeName: "NHS",storyScore: 'Score1'}]
        const storyNodeName = storyStates[idx-1].storyNodeName;
        const storyScore = storyStates[idx-1].storyScore;
        clicked(null,findNodeByName(storyNodeName),storyScore); 
        updateCurrentLevelsText(findNodeByName(storyNodeName));
        scoreSelector.value = storyScore;
        scoreSelector.dispatchEvent(new Event('change'));
      }
    }
    document.getElementById('nextCard').addEventListener('click', cardNavigation);
    document.getElementById('prevCard').addEventListener('click', cardNavigation);

    /*document.getElementById('storyButton2').addEventListener('click', () => {
           // Define the states with node names and scores
      // Get a reference to the button to modify it
      const storyButton = document.getElementById('storyButton2');
      const chartLabel = document.getElementById('chart-label');
      
      // Change the button's text to "Please wait" and disable it to prevent re-clicks.
      storyButton.textContent = 'Please wait';
      storyButton.disabled = true;
      
      // Define the states with node names and scores
      // Define the states with node names, scores, and now with stateLength (in ms) and a display label.
      const statesToAnimate = [
          { nodeName: 'NHS England', score: 'Score1', stateLength: 750, label: 'Going to Trust 1' },
          { nodeName: 'Region1', score: 'Score1', stateLength: 750, label: 'Going to Trust 1' },
          { nodeName: 'Trust1', score: 'Score1', stateLength: 2000, label: 'Now viewing Trust 1' },
          { nodeName: 'Region1', score: 'Score1', stateLength: 750, label: 'Going to Region 3' },
          { nodeName: 'NHS England', score: 'Score1', stateLength: 750, label: 'Going to Region 3' },
          { nodeName: 'Region3', score: 'Score1', stateLength: 2000, label: 'Final stop: Region 3' },
          { nodeName: 'NHS England', score: 'Score1', stateLength: 750, label: 'Resetting chart' }
        ];
      
      let currentStateIndex = 0;
      function transitionState() {
        // --- This is where you would display the label on your chart ---
        // For example, if you have an element with id="chart-label", you could do:
        // document.getElementById('chart-label').textContent = statesToAnimate[currentStateIndex].label;
        const currentState = statesToAnimate[currentStateIndex];
        chartLabel.textContent = currentState.label;
        chartLabel.style.opacity = 1; // Fade the label in

        
        const node = findNodeByName(currentState.nodeName); // Function to locate the node
        if (node) {
            clicked(null, node, currentState.score); // Invoke clicked function with the state
        }

        currentStateIndex++;

        // Check if there are more states to animate
        if (currentStateIndex < statesToAnimate.length) {
            // --- CHANGE 3: Use setTimeout for dynamic state lengths ---
            // Instead of a fixed setInterval, we use setTimeout to schedule the next
            // transition based on the current state's 'stateLength'.
            setTimeout(transitionState, currentState.stateLength);
        } else {
            // --- CHANGE 4: Revert button text when animation is done ---
            // Once all states have been processed, change the button text back and re-enable it.
            storyButton.textContent = 'Start Story'; // Or whatever your original text was
            storyButton.disabled = false;
            chartLabel.textContent =null;
            
        }
      }
      // The subsequent states will be triggered by the setTimeout inside transitionState
      transitionState();

    }); 
    */  
      function clicked(event, p,selectedScore=d3.select('#scoreSelector').property('value')) {
        //console.log(p)
        //console.log(selectedScore)
        currentNode = p; // Update the reference to the current node
        parent.datum(p.parent || root);
        //updateChart(selectedScore, p);
          updateCurrentLevelsText(p);
          //svg.selectAll('path.background-circle').remove();
    
          rootPartition.each(
            (d) =>
              (d.target = {
                x0:
                  Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
                  2 *
                  Math.PI,
                x1:
                  Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
                  2 *
                  Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth),
              }),
          );
    
          const currentSelScore = d3.select('#scoreSelector').property('value');
          //console.log(currentSelScore); // Log the current selected value
          centerText.raise();
          centerText.text(
            `${p.data.name}: ${p.data.scores[currentSelScore] || 0}%`,
          );
    
          const t = svg.transition().duration(750);
           
          const newColorScale = d3
          .scaleThreshold()
          .domain([50, 60, 70, 100])
          .range([colors[0], colors[1], colors[2], colors[3]]);
          
          path
            .transition(t)
            .attr('fill', (d) => newColorScale(d.data.scores[selectedScore] || 0))
            .tween('data', (d) => {
              const i = d3.interpolate(d.current, d.target);
              return (t) => (d.current = i(t));
            })
            .filter(function (d) {
              return +this.getAttribute('fill-opacity') || arcVisible(d.target);
            })
            .attr('pointer-events', (d) => (arcVisible(d.target) ? 'auto' : 'none'))
            .attrTween('d', (d) => () => arc(d.current));
    
          label
            .filter(function (d) {
              return +this.getAttribute('fill-opacity') || labelVisible(d.target);
            })
            .transition(t)
            .attr('fill-opacity', (d) => +labelVisible(d.target))
            .attrTween('transform', (d) => () => labelTransform(d.current))
            .text((d) =>
            d.data.scores[selectedScore] > threshVal
              ? `${d.data.name}: ${d.data.scores[selectedScore] || 0}%`
              : `${d.data.name}: Redacted`,
              );
          
    
      }

    const scoreSelector = document.getElementById('scoreSelector');

    scoreSelector.addEventListener('change', function () {
      const selectedScore = this.value;
      clicked(null,currentNode,selectedScore);
    });

    let currentNode = root; // Initialize to root node

    clicked(null,currentNode,d3.select('#scoreSelector').property('value')); // Default initialization with Score1

    function arcVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
      const y = ((d.y0 + d.y1) / 2) * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    function updateCurrentLevelsText(p) {
      const currentDepth = p.depth;
      const visibleMaxDepth = computeMaxDepth(p);
      const visibleLevels = Math.min(visibleMaxDepth, currentDepth + 2);
      const textContent =
        currentDepth === visibleLevels
          ? `Currently showing level ${currentDepth + 1}`
          : `Currently showing levels ${currentDepth + 1} to ${visibleLevels + 1}`;
      //const textContent = `Current score: ${p.data.scores.Score1 || 0}`;

      const el = document.getElementById('chartStatus');
      if (el) el.textContent = textContent;
    }

    function computeMaxDepth(node) {
      if (!node.children || node.children.length === 0) {
        return node.depth;
      }
      return Math.max(...node.children.map(computeMaxDepth));
    }

    // Load the CSV file and update the dropdown
fetch('https://raw.githubusercontent.com/mjm1169/D3_website/refs/heads/main/qText.csv')    
    .then(response => response.text())
    .then(text => {
        const data = d3.csvParse(text);
        const dropdown = d3.select('#scoreSelector');

        // Clear any existing options
        dropdown.selectAll('option').remove();

        // Append options from the CSV data
        data.forEach(d => {
            dropdown.append('option')
                .attr('value', d.QID)
                .text(d.Qtext);
        });

        // Set default selection to Score1
        dropdown.property('value', 'Score1');

        // Redefine update logic using selected QID
        dropdown.on('change', function() {
          const selectedScore = this.value;
          clicked(null,currentNode,d3.select('#scoreSelector').property('value'));
        });
    });
    function aggregateUniqueValues(node) {
    if (!node.children || node.children.length === 0) {
        return node.data.scores['value'] || 0;
    }
    node.data.scores['uniqueValue'] = node.children.reduce((acc, child) => {
        return acc + aggregateUniqueValues(child);
    }, 0);
    return node.data.scores['uniqueValue'];
    }

  })
  .catch(function (error) {
    console.log('Error loading the CSV data: ', error);
  });


/* ===============================
   Card carousel (left pane)
   - Non-destructive: does not touch D3 chart.
================================ */
(function initCardCarousel() {
  const cards = Array.from(document.querySelectorAll('.info-card'));
  if (!cards.length) return;

  const prevBtn = document.getElementById('prevCard');
  const nextBtn = document.getElementById('nextCard');
  const dotsEl = document.getElementById('cardDots');

  let idx = Math.max(0, cards.findIndex(c => c.classList.contains('active')));
  if (idx === -1) idx = 0;

  // Build dots
  if (dotsEl) {
    dotsEl.innerHTML = '';
    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'card-dot' + (i === idx ? ' active' : '');
      dot.setAttribute('aria-label', `Go to card ${i + 1}`);
      dot.addEventListener('click', () => setIdx(i));
      dotsEl.appendChild(dot);
    });
  }

  function render() {
    cards.forEach((c, i) => c.classList.toggle('active', i === idx));
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === cards.length - 1;

    if (dotsEl) {
      Array.from(dotsEl.children).forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    }
  }

  function setIdx(i) {
    idx = Math.min(cards.length - 1, Math.max(0, i));
    render();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => setIdx(idx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => setIdx(idx + 1));
  /*document.getElementById('downloadSVG').addEventListener('click', function() {
    var svgData = document.querySelector('#chart').innerHTML;
    var blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'chart.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });*/
  // Ensure at least one card is visible even if markup missed .active
  render();
  
  document.addEventListener("DOMContentLoaded", () => {
  const cards = Array.from(document.querySelectorAll(".info-card"));
  const prevBtn = document.querySelector('[data-action="prev"]');
  const nextBtn = document.querySelector('[data-action="next"]');
  const dotsWrap = document.querySelector(".card-dots");

  if (!cards.length || !prevBtn || !nextBtn || !dotsWrap) return;

  let idx = Math.max(0, cards.findIndex(c => c.classList.contains("active")));
  if (idx === -1) idx = 0;

  // Build dots if not present / mismatch
  if (dotsWrap.children.length !== cards.length) {
    dotsWrap.innerHTML = "";
    cards.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "card-dot";
      dot.dataset.index = String(i);
      dotsWrap.appendChild(dot);
    });
  }

  const dots = Array.from(dotsWrap.querySelectorAll(".card-dot"));

  function render() {
    cards.forEach((c, i) => c.classList.toggle("active", i === idx));
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === cards.length - 1;
  }

  prevBtn.addEventListener("click", () => {
    idx = Math.max(0, idx - 1);
    render();
  });

  nextBtn.addEventListener("click", () => {
    idx = Math.min(cards.length - 1, idx + 1);
    render();
  });

  dotsWrap.addEventListener("click", (e) => {
    const dot = e.target.closest(".card-dot");
    if (!dot) return;
    const i = Number(dot.dataset.index);
    if (!Number.isFinite(i)) return;
    idx = Math.max(0, Math.min(cards.length - 1, i));
    render();
  });

  render();
});

})();

// ==========================
// Download button: JPG export (1280x1280, high quality)
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const imgBtn = document.getElementById("downloadImageBtn");
  if (!imgBtn) return;

  const OUT_SIZE = 1280; // final JPG size (square)

  function buildSvgStringForJpgSquare() {
    const chartHost = document.getElementById("chart");
    const chartSvg = chartHost ? chartHost.querySelector("svg") : null;

    if (!chartSvg) return null;

    const W = OUT_SIZE;
    const H = OUT_SIZE;

    // Tight bounds of rendered chart
    let bbox;
    try {
      bbox = chartSvg.getBBox();
    } catch (e) {
      bbox = null;
    }

    // Fallback to viewBox / width/height
    const vb = chartSvg.getAttribute("viewBox");
    if (!bbox || !bbox.width || !bbox.height) {
      if (vb) {
        const parts = vb.split(/\s+/).map(Number);
        bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      } else {
        const w = parseFloat(chartSvg.getAttribute("width")) || 1200;
        const h = parseFloat(chartSvg.getAttribute("height")) || 1200;
        bbox = { x: 0, y: 0, width: w, height: h };
      }
    }

    // Small padding (in OUTPUT pixels) so outer rings don't clip
    const pad = Math.max(8, Math.round(W * 0.012));
    const bx = bbox.x - pad;
    const by = bbox.y - pad;
    const bw = bbox.width + pad * 2;
    const bh = bbox.height + pad * 2;

    // Fit into square (fill as much as possible)
    const maxChart = W * 1.0;
    const scale = Math.min(maxChart / bw, maxChart / bh);

    // Center
    const tx = (W - (bw * scale)) / 2 - (bx * scale);
    const ty = (H - (bh * scale)) / 2 - (by * scale);

    const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    exportSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    exportSvg.setAttribute("width", String(W));
    exportSvg.setAttribute("height", String(H));
    exportSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    // Background
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(W));
    bg.setAttribute("height", String(H));
    bg.setAttribute("fill", "#ffffff");
    exportSvg.appendChild(bg);

    // Clone chart content
    const content = document.createElementNS("http://www.w3.org/2000/svg", "g");
    Array.from(chartSvg.childNodes).forEach((n) => content.appendChild(n.cloneNode(true)));

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    g.appendChild(content);
    exportSvg.appendChild(g);

    // Legend/status (HTML) in the export using foreignObject
    const statusEl = document.getElementById("chartStatus");
    const legendEl = document.getElementById("chartLegend");

    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.setAttribute("x", "24");
    fo.setAttribute("y", "24");
    fo.setAttribute("width", String(Math.min(520, W - 48)));
    fo.setAttribute("height", String(Math.min(360, H - 48)));

    const foDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    foDiv.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    foDiv.innerHTML = `
      <style>
        .export-wrap { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #444; }
        .chart-legend { font-size: 16px; line-height: 1.35; color: #444; }
        .chart-legend-item { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
        .chart-legend-swatch { width: 14px; height: 14px; display: inline-block; }
      </style>
      <div class="export-wrap">
        <div style="margin-bottom:10px;">${statusEl ? statusEl.textContent : ""}</div>
        ${legendEl ? legendEl.outerHTML : ""}
      </div>
    `;
    fo.appendChild(foDiv);
    exportSvg.appendChild(fo);

    return new XMLSerializer().serializeToString(exportSvg);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  imgBtn.addEventListener("click", () => {
    const svgString = buildSvgStringForJpgSquare();
    if (!svgString) {
      alert("Could not find the chart to export.");
      return;
    }

    // Base64 data URL is more reliable than encodeURIComponent for larger SVGs
    const svgDataUrl =
      "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUT_SIZE;
      canvas.height = OUT_SIZE;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw 1:1 to avoid blur
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, OUT_SIZE, OUT_SIZE);

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to export image.");
          return;
        }
        downloadBlob(blob, "chart-panel.jpg");
      }, "image/jpeg", 0.95);
    };

    img.onerror = () => alert("Failed to render for export.");
    img.src = svgDataUrl;
  });
});
