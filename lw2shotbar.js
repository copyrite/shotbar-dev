window.onload = function() {
    breakdown = false;

    document.querySelectorAll(".input").forEach((elem) => { addEventListener("change", draw) })
    document.getElementById("breakdown-toggle").addEventListener("click", toggleExplain)

    toggleExplain();
}

function toggleExplain() {
    breakdown = !breakdown;

    button = document.getElementById("breakdown-toggle")
    if (breakdown){
        document.querySelectorAll(".breakdown").forEach((elem) => { elem.style.display = "inline" });
        button.innerHTML = "Hide breakdown";
    }
    else {
        document.querySelectorAll(".breakdown").forEach((elem) => { elem.style.display = "none" })
        button.innerHTML = "Show breakdown";
    }
    draw();
}

function clamp(x){
    return Math.max(0, Math.min(100, x));
}

function drawBar(canvas, shotbar) {
    canvas.width = document.body.clientWidth;
    canvas.height = 10;

    var vis = {width: 0.6*canvas.width, height: canvas.height, left: 0.2*canvas.width};

    var context = canvas.getContext("2d");

    context.fillStyle="#878700";
    context.fillRect(vis.left, 0, vis.width*shotbar.crit/100, 10);

    context.fillStyle="#870000";
    context.fillRect(vis.left + vis.width*shotbar.crit/100, 0, vis.width*shotbar.hit/100, 10);

    context.fillStyle="#008700";
    context.fillRect(vis.left + vis.width*(shotbar.crit + shotbar.hit)/100, 0, vis.width*shotbar.graze/100, 10);

    context.fillStyle="#878787";
    context.fillRect(vis.left + vis.width*(shotbar.crit + shotbar.hit + shotbar.graze)/100, 0, vis.width*shotbar.miss/100, 10);
    return canvas;
}

function draw() {
    var canvas = document.getElementById("shotbar");
    canvas.width = document.body.clientWidth;
    canvas.height = 10;
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    var breakdownDiv = document.getElementById("breakdown")
    breakdownDiv.innerHTML = ""

    // Inputs
    aim = clamp(parseInt(document.getElementById("input-aim").value));
    crit = parseInt(document.getElementById("input-crit").value);
    dodge = parseInt(document.getElementById("input-dodge").value);
    grazeband = parseInt(document.getElementById("input-grazeband").value);


    shotbars = [];

    // Initial
    initial = {
        "crit": 0,
        "hit": aim,
        "graze": 0,
        "miss": 100 - aim,
    };
    shotbars.push(initial);

    breakdownDiv.appendChild(document.createElement("p")).innerHTML = "The initial chance to hit is based on Aim:";
    breakdownDiv.appendChild(drawBar(document.createElement("canvas"), initial));


    // Apply graze band
    half_bandwidth = Math.min(grazeband, initial.hit, 100-initial.hit);
    banded = {"crit": 0};
    banded.hit = initial.hit - half_bandwidth;
    banded.graze = 2*half_bandwidth;
    banded.miss = 100 - banded.hit - banded.graze;
    shotbars.push(banded);
    if (grazeband > 0) {
        if (initial.hit == 0) {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Graze band would be applied here, but zero Aim has eliminated it completely."
        }
        else if (initial.miss == 0) {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Graze band would be applied here, but zero miss chance has eliminated it completely."
        }
        else {

            if (initial.hit < grazeband){
                helpText = "The graze band is applied equally on both sides around Aim. Because the chance to hit is low, the size of graze band is only equal to Aim:";
            }
            else if (100 - initial.hit < grazeband){
                helpText = "The graze band is applied equally on both sides around Aim. Because the chance to miss is low, the size of graze band is only equal to miss chance:";
            }
            else {
                helpText = "The graze band is applied equally on both sides around Aim:";
            }
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = helpText;

        }

        if (initial.hit != banded.hit || initial.miss != banded.miss){
            breakdownDiv.appendChild(drawBar(document.createElement("canvas"), banded));
        }
    }


    // Promotion and demotion
    promote = crit*(100 - dodge)/100;
    demote = (100 - crit)*dodge/100;
    neutral = 100 - promote - demote;

    promoted = {
        "crit": promote*banded.hit/100,
        "hit": (neutral*banded.hit + promote*banded.graze)/100,
        "graze": (neutral*banded.graze + demote*banded.hit)/100,
        "miss": banded.miss + demote*banded.graze/100,
    }
    shotbars.push(promoted)

    if (neutral == 1){
        breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Hit promotion and demotion would be applied here, but both attacker crit and target dodge are zero."
    }
    else {
        if ([promote, demote, neutral].some((elem) => (elem < 0))){
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = "Hit promotion and demotion are applied. One of the chances is negative, which is valid in-game but this calculator doesn't yet adequately explain that.";
        }
        else {
            breakdownDiv.appendChild(document.createElement("p")).innerHTML = `Hit promotion and demotion are applied:
            <ul>
            <ui>A normal hit can be promoted into a crit and demoted into a graze</ui>
            <ui>A graze can be promoted into a normal hit and demoted into a miss</ui>
            </ul>
            Promotion/demotion chances are:
            <ul>
            <ui>${(promote).toFixed(3)}% to promote (Successful Crit roll and failed Dodge roll)
            <ui>${(demote).toFixed(3)}% to demote (Failed Crit roll and successful Dodge roll)
            <ui>${(neutral).toFixed(3)}% to remain the same (Crit roll and Dodge roll both succeed, or both fail)
            </ul>`

        }

    }

    lastBar = shotbars[shotbars.length-1]
    // Textual output
    internalNames = ["crit", "hit", "graze", "miss"];
    userNames = ["Crit", "Normal hit", "Graze", "Miss"];
    for (i = 0; i < 4; ++i){
        document.getElementById("output-" + internalNames[i]).innerHTML = userNames[i] + ": " + (lastBar[internalNames[i]]).toFixed(3) + "%"
    }


    // Render final shotbar
    drawBar(document.getElementById("shotbar"), lastBar);
};
