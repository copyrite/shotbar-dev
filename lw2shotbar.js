window.onload = function () {
    document.querySelectorAll(".input").forEach((elem) => {
        addEventListener("change", draw);
    });
    window.addEventListener("resize", draw);

    draw();
};

function clamp(x){
    return Math.max(0, Math.min(100, x));
}

function draw() {
    var breakdownDiv = document.getElementById("breakdown")
    breakdownDiv.innerHTML = ""
    var widthRatio = 0.6;
    var dims = {
        "x": breakdownDiv.getClientRects()[0].width*(1- widthRatio)/2,
        "width": breakdownDiv.getClientRects()[0].width*widthRatio/100,
        "height": "1.2em",
    };
    d3.select("#breakdown")
        .append("div")
        .attr("id", "tooltip")
        .attr("style", "position: absolute; left: 0; top: 0; transform: translate(-50%, -100%)");


    // Inputs
    aim = clamp(parseInt(document.getElementById("input-aim").value));
    crit = parseInt(document.getElementById("input-crit").value);
    dodge = parseInt(document.getElementById("input-dodge").value);
    grazeband = parseInt(document.getElementById("input-grazeband").value);


    shotbars = [];

    // Initial
    initial = [
        {"value": 0, color: "#878700", text: "Crit"},
        {"value": aim, color: "#870000", text: "Normal hit"},
        {"value": 0, color: "#008700", text: "Graze"},
        {"value": 100 - aim, color: "#878787", text: "Miss"},
    ]
    shotbars.push(initial);

    breakdownDiv.appendChild(document.createElement("p")).innerHTML = "The initial chance to hit is based on Aim:";

    d3.select("#breakdown")
        .append("svg")
        .attr("width", "100%")
        .attr("style", `height: ${dims.height}`);


    // Apply graze band
    halfBandwidth = Math.min(grazeband, initial[1].value, 100-initial[1].value);
    banded = [{"value": 0, color: "#878700", text: "Crit"}];
    banded.push({"value": initial[1].value - halfBandwidth, color: "#870000", text: "Normal hit"});
    banded.push({"value": 2*halfBandwidth, color: "#008700", text: "Graze"});
    banded.push({"value": 100 - banded[0].value - banded[1].value - banded[2].value, color: "#878787", text: "Miss"});

    shotbars.push(banded);

    if (grazeband > 0) {
        if (initial[1].value == 0) {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Graze band would be applied here, but zero Aim has eliminated it completely."
        }
        else if (initial[3].value == 0) {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Graze band would be applied here, but zero miss chance has eliminated it completely."
        }
        else {

            if (initial[1].value < grazeband){
                helpText = "The graze band is applied equally on both sides around Aim. Because the chance to hit is low, the size of graze band is only equal to Aim:";
            }
            else if (100 - initial[1].value < grazeband){
                helpText = "The graze band is applied equally on both sides around Aim. Because the chance to miss is low, the size of graze band is only equal to miss chance:";
            }
            else {
                helpText = "The graze band is applied equally on both sides around Aim:";
            }
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = helpText;
        }
    }

    d3.select("#breakdown")
        .append("svg")
        .attr("width", "100%")
        .attr("style", `height: ${dims.height}`);

    // Promotion
    promote = Math.min(crit - Math.min(0, dodge), 100); // Negative dodge is additional crit
    promoted = [{"value": promote*banded[1].value/100, color: "#878700", text: "Crit"}];
    promoted.push({"value": banded[1].value + promote*(banded[2].value - banded[1].value)/100, color: "#870000", text: "Normal hit"});
    promoted.push({"value": banded[2].value - promote*banded[2].value/100, color: "#008700", text: "Graze"});
    promoted.push({"value": 100 - promoted[0].value - promoted[1].value - promoted[2].value, color: "#878787", text: "Miss"});

    shotbars.push(promoted);

    if (promote == 0){
        breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Hit promotion would be applied here, but Crit is zero and Dodge is not negative."
    }
    else {
        if (dodge >= 0){
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Crit promotes normal hits into crits and grazes into normal hits."
        }
        else if (crit <= 0){
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Negative Dodge acts like crit, promoting normal hits into crits and grazes into normal hits."
        }
        else {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Crit and negative Dodge are added together, promoting normal hits into crits and grazes into normal hits."
        }
    }

    d3.select("#breakdown")
        .append("svg")
        .attr("width", "100%")
        .attr("style", `height: ${dims.height}`)

    // Demotion
    demote = Math.min(Math.max(dodge, 0), 100);
    demoted = [{"value": (100 - demote)*promoted[0].value/100, color: "#878700", text: "Crit"}]
    demoted.push({"value": promoted[1].value + demote*(promoted[0].value - promoted[1].value)/100, color: "#870000", text: "Normal hit"})
    demoted.push({"value": promoted[2].value + demote*(promoted[1].value - promoted[2].value)/100, color: "#008700", text: "Graze"})
    demoted.push({"value": 100 - demoted[0].value - demoted[1].value - demoted[2].value, color: "#878787", text: "Miss"})
    shotbars.push(demoted)

    if (demote == 0){
        breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Hit demotion would be applied here, but Dodge is not positive."
    }
    else {
        breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Dodge demotes Crits into normal hits, normal hits into grazes, and grazes into misses.";
    }

    d3.select("#breakdown")
        .append("svg")
        .attr("width", "100%")
        .attr("style", `height: ${dims.height}`)

    lastBar = shotbars[shotbars.length-1]
    // Textual output
    internalNames = ["crit", "hit", "graze", "miss"];
    userNames = ["Crit", "Normal hit", "Graze", "Miss"];
    for (i = 0; i < 4; ++i){
        document.getElementById("output-" + internalNames[i]).innerHTML = userNames[i] + ": " + (lastBar[i].value).toFixed(3) + "%"
    }


    d3.selectAll("svg")
        .data(shotbars)
        .join("svg")
        .each((outer) => {
            xIter = d3
                .cumsum([0].concat(outer.slice(0, 3).map((x) => x.value)))
                .values();
            for (inner of outer) {
                inner.x = xIter.next().value;
            }
        })
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .each(elem => {elem.text = `${elem.text}: ${elem.value.toFixed(3)}%`})
        .attr("x", (elem) => dims.x + elem.x*dims.width)
        .attr("y", (elem) => 0)
        .attr("width", (elem) => elem.value*dims.width)
        .attr("height", (elem) => dims.height)
        .attr("fill", (elem) => elem.color)
        .attr("rx", (elem) => 2)
        .attr("ry", (elem) => 2)
        .attr("text", (elem) => elem.text)
        .on("mouseleave", (event) => {
            d3.select("#tooltip")
                .style("display", "none")
        })
        .on("mouseover", (event) => {
            d3.select("#tooltip")
                .style("display", "block")
                .style("left", event.target.getScreenCTM().e + window.pageXOffset + event.target.x.animVal.value + event.target.width.animVal.value/2 + "px")
                .style("top", event.target.getScreenCTM().f + window.pageYOffset + event.target.y.animVal.value + "px")
                .text(event.target.getAttribute("text"));
        });
};
