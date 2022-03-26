window.onload = function () {
    d3.selectAll(".input").on("change", draw);
    d3.select(window).on("resize", draw);

    d3.select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("transform", "translate(-50%, -100%)")
        .style("background-color", "inherit");

    colors = {
        crit: "#808000",
        hit: "#800000",
        graze: "#008000",
        miss: "#808080",
        blendRatio: 0.33,
    };
    colors.array = [colors.crit, colors.hit, colors.graze, colors.miss];
    hitRanks = {
        crit: "Crit",
        hit: "Normal hit",
        graze: "Graze",
        miss: "Miss",
    };
    hitRanks.array = [
        hitRanks.crit,
        hitRanks.hit,
        hitRanks.graze,
        hitRanks.miss,
    ];

    intFormat = d3.format(".0f");
    decFormat = d3.format(".1f");

    draw();
};

function clamp(x) {
    return Math.max(0, Math.min(100, x));
}

function colorblend(left, right, lambda) {
    lcol = d3.color(left);
    rcol = d3.color(right);
    return d3.rgb(
        (1 - lambda) * lcol.r + lambda * rcol.r,
        (1 - lambda) * lcol.g + lambda * rcol.g,
        (1 - lambda) * lcol.b + lambda * rcol.b,
        (1 - lambda) * lcol.a + lambda * rcol.a
    );
}

function setLeftCoords(array) {
    lefts =
        array.length == 0
            ? array
            : (xIter = d3.cumsum(
                  [0].concat(array.slice(0, -1).map((x) => x.value))
              ));
    return array.forEach((e, i) => (e.x = lefts[i]));
}

function draw() {
    var breakdownDiv = d3.select("#breakdown").node();
    breakdownDiv.innerHTML = "";
    var widthRatio = 0.6;
    var dims = {
        width: breakdownDiv.getClientRects()[0].width * widthRatio,
        singleHeightPx: 16,
        doubleHeightPx: 4 * 16,
    };

    // Inputs
    aim = parseInt(d3.select("#input-aim").property("value"));
    crit = parseInt(d3.select("#input-crit").property("value"));
    dodge = parseInt(d3.select("#input-dodge").property("value"));
    grazeband = parseInt(d3.select("#input-grazeband").property("value"));

    breakdown = [];

    // Initial
    initial = {
        crit: 0,
        hit: aim,
        graze: 0,
    };
    initial.miss = 100 - initial.hit;
    breakdown.push({
        text: `The initial chance to normally hit is ${intFormat(
            initial.hit
        )}%, determined by Aim. The remainder is chance to miss.`,
        old: [],
        new: [
            { value: initial.crit },
            { value: initial.hit },
            { value: initial.graze },
            { value: initial.miss },
        ],
        links: [],
    });

    // Graze banded
    var halfBandwidth = Math.min(grazeband, initial.hit, initial.miss);
    var bandedAtoms = [
        {
            value: initial.hit - halfBandwidth,
            color: colors.hit,
            text: `Remaining normal hit`,
        },
        {
            value: halfBandwidth,
            color: colorblend(colors.hit, colors.graze, colors.blendRatio),
            text: `Graze band`,
        },
        {
            value: halfBandwidth,
            color: colorblend(colors.miss, colors.graze, colors.blendRatio),
            text: `Graze band`,
        },
        {
            value: initial.miss - halfBandwidth,
            color: colors.miss,
            text: `Remaining miss`,
        },
    ];
    banded = {
        crit: 0,
        hit: bandedAtoms[0].value,
        graze: bandedAtoms[1].value + bandedAtoms[2].value,
        miss: bandedAtoms[3].value,
    };
    var helpText = "";
    if (grazeband > 0) {
        if (halfBandwidth == 0) {
            helpText = `Graze band would replace parts of normal hit chance and miss chance, but because ${
                initial.hit == 0 ? "Aim" : "miss chance"
            } is zero, it has been eliminated completely.`;
        } else {
            helpText = `Graze band replaces ${intFormat(
                2 * halfBandwidth
            )}% of the shotbar with chance to graze. Half of it is taken from normal hit chance, half from miss chance.${
                halfBandwidth < grazeband
                    ? ` It has been applied at a reduced value because ${
                          initial.hit < grazeband ? "Aim" : "the chance to miss"
                      } is low.`
                    : ""
            }`;
        }
    } else {
        helpText =
            "Graze band has been set to zero, so the shotbar won't be modified at this point.";
    }
    breakdown.push({
        text: helpText,
        old: bandedAtoms,
        new: [
            { value: banded.crit },
            { value: banded.hit },
            { value: banded.graze },
            { value: banded.miss },
        ],
    });
    breakdown.at(-1).links = [
        { from: bandedAtoms[1], to: breakdown.at(-1).new[2] },
        { from: bandedAtoms[2], to: breakdown.at(-1).new[2] },
    ];

    // Promoted
    var promoteChance = Math.min(crit - Math.min(0, dodge), 100); // Negative dodge is additional crit
    var promotedAtoms = [
        {
            value: (promoteChance * banded.hit) / 100,
            color: colorblend(colors.hit, colors.crit, colors.blendRatio),
            text: `${decFormat(promoteChance)}% of normal hit`,
        },
        {
            value: ((100 - promoteChance) * banded.hit) / 100,
            color: colors.hit,
            text: `${decFormat(100 - promoteChance)}% of normal hit`,
        },
        {
            value: (promoteChance * banded.graze) / 100,
            color: colorblend(colors.graze, colors.hit, colors.blendRatio),
            text: `${decFormat(promoteChance)}% of graze`,
        },
        {
            value: ((100 - promoteChance) * banded.graze) / 100,
            color: colors.graze,
            text: `${decFormat(100 - promoteChance)}% of graze`,
        },
        {
            value: banded.miss,
            color: colors.miss,
            text: `Miss`,
        },
    ];
    promoted = {
        crit: promotedAtoms[0].value,
        hit: promotedAtoms[1].value + promotedAtoms[2].value,
        graze: promotedAtoms[3].value,
        miss: promotedAtoms[4].value,
    };

    if (promoted.miss == 100) {
        helpText =
            "Hit promotion would be applied here, but there is no chance to hit.";
    } else if (promoteChance == 0) {
        helpText =
            "Hit promotion would be applied here, but Crit is zero and Dodge is not negative.";
    } else {
        helpText = `Hit promotion is applied at ${intFormat(
            promoteChance
        )}% chance, determined by ${
            crit > 0 && dodge < 0
                ? "the sum of Crit and negative Dodge"
                : crit > 0
                ? "Crit"
                : "negative Dodge"
        }. Normal hits can promote into crits and grazes into normal hits:`;
    }
    breakdown.push({
        text: helpText,
        old: promotedAtoms,
        new: [
            { value: promoted.crit },
            { value: promoted.hit },
            { value: promoted.graze },
            { value: promoted.miss },
        ],
    });
    breakdown.at(-1).links = [
        { from: promotedAtoms[0], to: breakdown.at(-1).new[0] },
        { from: promotedAtoms[1], to: breakdown.at(-1).new[1] },
        { from: promotedAtoms[2], to: breakdown.at(-1).new[1] },
        { from: promotedAtoms[3], to: breakdown.at(-1).new[2] },
    ];

    // Demoted
    var demoteChance = Math.min(Math.max(dodge, 0), 100);
    var demotedAtoms = [
        {
            value: (promoted.crit * (100 - demoteChance)) / 100,
            color: colors.crit,
            text: `${decFormat(100 - demoteChance)}% of crit`,
        },
        {
            value: (promoted.crit * demoteChance) / 100,
            color: colorblend(colors.crit, colors.hit, colors.blendRatio),
            text: `${decFormat(demoteChance)}% of crit`,
        },
        {
            value: (promoted.hit * (100 - demoteChance)) / 100,
            color: colors.hit,
            text: `${decFormat(100 - demoteChance)}% of normal hit`,
        },
        {
            value: (promoted.hit * demoteChance) / 100,
            color: colorblend(colors.hit, colors.graze, colors.blendRatio),
            text: `${decFormat(demoteChance)}% of normal hit`,
        },
        {
            value: (promoted.graze * (100 - demoteChance)) / 100,
            color: colors.graze,
            text: `${decFormat(100 - demoteChance)}% of graze`,
        },
        {
            value: (promoted.graze * demoteChance) / 100,
            color: colorblend(colors.graze, colors.miss, colors.blendRatio),
            text: `${decFormat(demoteChance)}% of graze`,
        },
        { value: promoted.miss, color: colors.miss, text: "Miss" },
    ];
    demoted = {
        crit: demotedAtoms[0].value,
        hit: demotedAtoms[1].value + demotedAtoms[2].value,
        graze: demotedAtoms[3].value + demotedAtoms[4].value,
        miss: demotedAtoms[5].value + demotedAtoms[6].value,
    };

    if (promoted.miss == 100) {
        helpText =
            "Hit demotion would be applied here, but there is no chance to hit.";
    } else if (demoteChance == 0) {
        helpText =
            "Hit demotion would be applied here, but Dodge is not positive.";
    } else {
        helpText = `Hit demotion is applied at ${intFormat(
            demoteChance
        )}% chance, determined by Dodge. Crits are demoted into normal hits, normal hits into grazes, and grazes into misses.`;
    }

    breakdown.push({
        text: helpText,
        old: demotedAtoms,
        new: [
            { value: demoted.crit },
            { value: demoted.hit },
            { value: demoted.graze },
            { value: demoted.miss },
        ],
    });
    breakdown.at(-1).links = [
        { from: demotedAtoms[0], to: breakdown.at(-1).new[0] },
        { from: demotedAtoms[1], to: breakdown.at(-1).new[1] },
        { from: demotedAtoms[2], to: breakdown.at(-1).new[1] },
        { from: demotedAtoms[3], to: breakdown.at(-1).new[2] },
        { from: demotedAtoms[4], to: breakdown.at(-1).new[2] },
        { from: demotedAtoms[5], to: breakdown.at(-1).new[3] },
        { from: demotedAtoms[6], to: breakdown.at(-1).new[3] },
    ];

    breakdown.forEach((outer) => {
        outer.new.forEach((e, i) => {
            e.color = colors.array[i];
            e.text = hitRanks.array[i];
        });

        outer.old.length > 0
            ? outer.new.forEach(
                  (inner) =>
                      (inner.y = dims.doubleHeightPx - dims.singleHeightPx)
              )
            : 0;
    });

    d3.select("#breakdown")
        .selectAll("div")
        .data(breakdown)
        .join("div")
        .append("span")
        .text((d) => d.text);
    d3.select("#breakdown")
        .selectAll("div")
        .data(breakdown)
        .join("div")
        .append("svg")
        .attr("width", dims.width)
        .attr("height", (d, i) => {
            if (d.old.length == 0) {
                return dims.singleHeightPx;
            } else if (
                d.new
                    .map((e, j) => e.value - breakdown[i - 1].new[j].value)
                    .every((e) => Math.abs(e) <= 0.000001)
            ) {
                return 0;
            }
            return dims.doubleHeightPx;
        })
        .style("padding", "1em 0");

    // Olds
    d3.select("#breakdown")
        .selectAll("svg")
        .data(breakdown.map((d) => d.old))
        .each((outer) => {
            lefts =
                outer.length == 0
                    ? outer
                    : (xIter = d3.cumsum(
                          [0].concat(outer.slice(0, -1).map((x) => x.value))
                      ));
            outer.forEach((inner, i) => (inner.x = lefts[i]));
        })
        .selectAll("g")
        .data((d) => d)
        .join("rect")
        .attr("x", (d) => (d.x * dims.width) / 100)
        .attr("y", 0)
        .attr("width", (d) => (d.value * dims.width) / 100)
        .attr("height", dims.singleHeightPx)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", (d) => d.color)
        .attr(
            "tooltip",
            (d) =>
                `<span style="font-size: 1.5em">${decFormat(
                    d.value
                )}%</span><br>${d.text}`
        )
        .on("mouseleave", (event) => {
            d3.select("#tooltip").style("display", "none");
        })
        .on("mouseover", (event) => {
            d3.select("#tooltip")
                .style("display", "block")
                .style("text-align", "center")
                .style(
                    "left",
                    event.target.getScreenCTM().e +
                        window.pageXOffset +
                        event.target.x.animVal.value +
                        event.target.width.animVal.value / 2 +
                        "px"
                )
                .style(
                    "top",
                    event.target.getScreenCTM().f +
                        window.pageYOffset +
                        event.target.y.animVal.value +
                        "px"
                )
                .html(event.target.getAttribute("tooltip"));
        });

    // News
    d3.select("#breakdown")
        .selectAll("svg")
        .data(breakdown.map((d) => d.new))
        .each(setLeftCoords)
        .selectAll("g")
        .data((d) => d)
        .join("rect")
        .attr("x", (d) => (d.x * dims.width) / 100)
        .attr("y", (d) => d.y)
        .attr("width", (d) => (d.value * dims.width) / 100)
        .attr("height", dims.singleHeightPx)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", (d) => d.color)
        .attr(
            "tooltip",
            (d) =>
                `<span style="font-size: 1.5em">${decFormat(
                    d.value
                )}%</span><br>${d.text}`
        )
        .on("mouseleave", (event) => {
            d3.select("#tooltip").style("display", "none");
        })
        .on("mouseover", (event) => {
            d3.select("#tooltip")
                .style("display", "block")
                .style(
                    "left",
                    event.target.getScreenCTM().e +
                        window.pageXOffset +
                        event.target.x.animVal.value +
                        event.target.width.animVal.value / 2 +
                        "px"
                )
                .style(
                    "top",
                    event.target.getScreenCTM().f +
                        window.pageYOffset +
                        event.target.y.animVal.value +
                        "px"
                )
                .html(event.target.getAttribute("tooltip"));
        });

    // Links
    d3.select("#breakdown")
        .selectAll("svg")
        .data(breakdown.map((d) => d.links))
        .selectAll("g")
        .data((d) => d)
        .join("path")
        .attr(
            "d",
            (d) =>
                `M ${((d.to.x + d.to.value / 2) * dims.width) / 100} ${
                    dims.doubleHeightPx - dims.singleHeightPx
                } C ${((d.to.x + d.to.value / 2) * dims.width) / 100} ${
                    0.5 * dims.doubleHeightPx
                } , ${((d.from.x + d.from.value / 2) * dims.width) / 100} ${
                    0.5 * dims.doubleHeightPx
                } , ${((d.from.x + d.from.value / 2) * dims.width) / 100} ${
                    dims.singleHeightPx
                }`
        )
        .attr("stroke", "#C0C0C0")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", 4)
        .attr("stroke-linecap", "butt")
        .attr("fill", "transparent")
        .style("display", (d) =>
            d.from.value > 0 && d.to.value > 0 ? "" : "none"
        );

    d3.select("#output")
        .selectAll("span")
        .data(breakdown.at(-1).new)
        .join("span")
        .text((d) => `${d.text}: ${decFormat(d.value)}%`)
        .style("text-decoration", "underline")
        .style("text-decoration-color", (d) => d.color)
        .style("text-decoration-thickness", "0.12em");
}
