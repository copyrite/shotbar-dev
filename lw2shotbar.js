window.onload = function() {
    explain = true;
    explainPage = 0;
    lastPage = 3;

    document.querySelectorAll(".input").forEach((elem) => { addEventListener("change", draw) })
    document.getElementById("breakdown-toggle").addEventListener("click", toggleExplain)
    document.getElementById("breakdown-prev").addEventListener("click", () => navExplain(-1))
    document.getElementById("breakdown-next").addEventListener("click", () => navExplain(1))

    toggleExplain();
}

function toggleExplain() {
    explain = !explain;

    if (explain){
        explainPage = 0;
        document.querySelectorAll(".breakdown").forEach((elem) => { elem.style.display = "inline" });
        navExplain(0)
    }
    else {
        explainPage = lastPage - 1;
        document.querySelectorAll(".breakdown").forEach((elem) => { elem.style.display = "none" })
    }
    draw();
}

function navExplain(diff) {
    explainPage += diff;
    document.querySelectorAll(".breakdown-page").forEach((elem) => { elem.style.display = "none" });
    document.getElementById("breakdown-" + explainPage).style.display = "inline";
    draw();
}

function clamp(x){
    return Math.max(0, Math.min(1, x));
}

function draw() {
    var canvas = document.getElementById("shotbar");
    canvas.width = document.body.clientWidth;
    canvas.height = 20;
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Inputs
    aim = clamp(parseInt(document.getElementById("input-aim").value)/100);
    crit = parseInt(document.getElementById("input-crit").value)/100;
    dodge = parseInt(document.getElementById("input-dodge").value)/100;
    grazeband = parseInt(document.getElementById("input-grazeband").value)/100;


    shotbars = []

    // Initial
    shotbars.push({
        "crit": 0,
        "hit": aim,
        "graze": 0,
        "miss": 1 - aim,
    })


    // Apply graze band
    shotbars.push({"crit": 0})
    if (shotbars[0].hit < grazeband){
        shotbars[1].hit = 0;
        shotbars[1].graze = 2*shotbars[0].hit;
    }
    else if (1 - shotbars[0].hit < grazeband){
        shotbars[1].hit = 2*shotbars[0].hit - 1;
        shotbars[1].graze = 2*(1 - shotbars[0].hit);
    }
    else {
        shotbars[1].hit = shotbars[0].hit - grazeband;
        shotbars[1].graze = 2*grazeband;
    }
    shotbars[1].miss = 1 - shotbars[1].hit - shotbars[1].graze


    // Upgrade and downgrade
    up = crit*(1 - dodge);
    down = (1 - crit)*dodge;
    neutral = 1 - up - down

    shotbars.push({
        "crit": up*shotbars[1].hit,
        "hit": neutral*shotbars[1].hit + up*shotbars[1].graze,
        "graze": neutral*shotbars[1].graze + down*shotbars[1].hit,
        "miss": shotbars[1].miss + down*shotbars[1].graze,
    })

    // Textual output
    internalNames = ["crit", "hit", "graze", "miss"];
    userNames = ["Crit", "Normal hit", "Graze", "Miss"];
    for (i = 0; i<4; ++i){
        document.getElementById("output-" + internalNames[i]).innerHTML = userNames[i] + ": " + (100 * shotbars[explainPage][internalNames[i]]).toFixed(3) + "%"
    }


    // Render
    vis = {width: 0.6*canvas.width, height: canvas.height, left: 0.2*canvas.width};

    context.fillStyle="#878700";
    context.fillRect(vis.left, 0, vis.width*shotbars[explainPage].crit, 10);

    context.fillStyle="#870000";
    context.fillRect(vis.left + vis.width*shotbars[explainPage].crit, 0, vis.width*shotbars[explainPage].hit, 10);

    context.fillStyle="#008700";
    context.fillRect(vis.left + vis.width*(shotbars[explainPage].crit + shotbars[explainPage].hit), 0, vis.width*shotbars[explainPage].graze, 10);

    context.fillStyle="#878787";
    context.fillRect(vis.left + vis.width*(shotbars[explainPage].crit + shotbars[explainPage].hit + shotbars[explainPage].graze), 0, vis.width*shotbars[explainPage].miss, 10);
};
