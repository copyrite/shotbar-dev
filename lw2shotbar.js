window.onload = function () {
    hitRankArray = ["crit", "hit", "graze", "miss"];
    hitRankColors = {
        crit: "#95791b",
        hit: "#72141c",
        graze: "#468652",
        miss: "#5c6060",
    };
    hitRankFriendlyNames = {
        crit: "Crit",
        hit: "Normal hit",
        graze: "Graze",
        miss: "Miss",
    };

    intFormat = d3.format(".0f");
    decFormat = d3.format(".1f");

    d3.select(window).on("resize", draw);

    d3.select("body")
        .html("")
        .append("div")
        .attr("id", "input")
        .attr("class", "fancy-shape")
        .append("p")
        .selectAll("div")
        .data([
            { min: 0, max: 100, value: 65, text: "Aim" },
            { min: 0, max: 100, value: 0, text: "Crit" },
            { min: 0, max: 100, value: 0, text: "Dodge" },
            { min: 0, max: 100, value: 10, text: "Graze band" },
        ])
        .join("div")
        .text((d) => d.text)
        .append("input")
        .attr("type", "number")
        .attr("id", (d) => "input-" + d.text.replace(" ", "").toLowerCase())
        .attr("min", (d) => d.min)
        .attr("max", (d) => d.max)
        .attr("value", (d) => d.value)
        .on("change", draw);
    d3.select("body").append("div").attr("id", "breakdown");
    d3.select("body")
        .append("div")
        .attr("id", "output")
        .attr("class", "fancy-shape");

    d3.select("body")
        .append("div")
        .attr("id", "tooltip")
        .attr("class", "fancy-shape")
        .style("position", "absolute")
        .style("transform", "translate(-50%, -100%)")
        .style("padding", "0.5em")
        .style("display", "none");

    draw();
};

function clamp(x) {
    return Math.max(0, Math.min(100, x));
}

function modifyHitDistribution(hitDistribution, modifiers) {
    let rtn = _.cloneDeep(hitDistribution);

    let breakdown = { line1: {}, line2: {}, links: [] };

    for (to of hitRankArray) {
        breakdown.line1[to] = {};
        breakdown.line1[to][to] = { value: hitDistribution[to] };
    }

    for (mod of modifiers) {
        breakdown.line1[mod.from] ??= {};
        breakdown.line1[mod.from][mod.to] ??= {};
        breakdown.line1[mod.from][mod.to].value ??= mod.value;
        breakdown.line1[mod.from][mod.to].text ??= mod.text;
        breakdown.line1[mod.from][mod.to].color ??= mod.color;

        if (mod.value > 0) {
            rtn[mod.to] += mod.value;
            rtn[mod.from] -= mod.value;
            breakdown.line1[mod.from][mod.from].value -= mod.value;
        }
        if (mod.link) {
            breakdown.links.push({ from: mod.from, to: mod.to });
        }
    }

    for (to of hitRankArray) {
        breakdown.line2[to] ??= {};
        breakdown.line2[to].value ??= rtn[to];
    }
    rtn.breakdown.push(breakdown);

    return rtn;
}

function makeInitialShotbar(aim) {
    let rtn = {
        crit: 0,
        hit: clamp(aim),
        graze: 0,
    };
    rtn.miss = 100 - rtn.hit;

    let breakdown = {
        text: `The initial chance to normally hit is ${intFormat(
            rtn.hit
        )}%, determined by Aim. The remainder is chance to miss.`,
        line1: {},
        line2: {},
    };
    for (rank of hitRankArray) {
        breakdown.line1[rank] = {};
        breakdown.line1[rank][rank] = { value: rtn[rank] };
        breakdown.line2[rank] = { value: rtn[rank] };
    }
    rtn.breakdown = [breakdown];
    return rtn;
}

function applyGrazeBand(grazeband) {
    return (hitDistribution) => {
        let halfBandwidth = Math.min(
            grazeband,
            hitDistribution.hit,
            hitDistribution.miss
        );

        let rtn = modifyHitDistribution(hitDistribution, [
            {
                from: "hit",
                to: "graze",
                value: halfBandwidth,
                text: "Graze band",
                link: true,
            },
            {
                from: "miss",
                to: "graze",
                value: halfBandwidth,
                text: "Graze band",
                link: true,
            },
            { from: "hit", to: "hit", text: "Remaining normal hit" },
            { from: "miss", to: "miss", text: "Remaining miss" },
        ]);

        let helpText;
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
                              initial.hit < grazeband
                                  ? "Aim"
                                  : "the chance to miss"
                          } is low.`
                        : ""
                }`;
            }
        } else {
            helpText =
                "Graze band has been set to zero, so the shotbar won't be modified at this point.";
        }
        _.last(rtn.breakdown).text = helpText;

        return rtn;
    };
}

function applyHitPromotion(promoteChance) {
    return (hitDistribution) => {
        let rtn = modifyHitDistribution(hitDistribution, [
            {
                from: "hit",
                to: "crit",
                value: (promoteChance * hitDistribution.hit) / 100,
                text: `${decFormat(promoteChance)}% of normal hit`,
                link: true,
            },
            {
                from: "hit",
                to: "hit",
                text: `${decFormat(100 - promoteChance)}% of normal hit`,
                link: true,
            },
            {
                from: "graze",
                to: "hit",
                value: (promoteChance * hitDistribution.graze) / 100,
                text: `${decFormat(promoteChance)}% of graze`,
                link: true,
            },
            {
                from: "graze",
                to: "graze",
                text: `${decFormat(100 - promoteChance)}% of graze`,
                link: true,
            },
        ]);

        let helpText;
        if (rtn.miss == 100) {
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
        _.last(rtn.breakdown).text = helpText;

        return rtn;
    };
}

function applyHitDemotion(demoteChance) {
    return (hitDistribution) => {
        let rtn = modifyHitDistribution(hitDistribution, [
            {
                from: "crit",
                to: "crit",
                text: `${decFormat(100 - demoteChance)}% of crit`,
                link: true,
            },
            {
                from: "crit",
                to: "hit",
                value: (hitDistribution.crit * demoteChance) / 100,
                text: `${decFormat(demoteChance)}% of crit`,
                link: true,
            },
            {
                from: "hit",
                to: "hit",
                text: `${decFormat(100 - demoteChance)}% of normal hit`,
                link: true,
            },
            {
                from: "hit",
                to: "graze",
                value: (hitDistribution.hit * demoteChance) / 100,
                text: `${decFormat(demoteChance)}% of normal hit`,
                link: true,
            },
            {
                from: "graze",
                to: "graze",
                text: `${decFormat(100 - demoteChance)}% of graze`,
                link: true,
            },
            {
                from: "graze",
                to: "miss",
                value: (hitDistribution.graze * demoteChance) / 100,
                text: `${decFormat(demoteChance)}% of graze`,
                link: true,
            },
            { from: "miss", to: "miss", link: true },
        ]);

        let helpText;
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
        _.last(rtn.breakdown).text = helpText;

        return rtn;
    };
}

function colorblend(left, right, lambda) {
    let lcol = d3.color(left);
    let rcol = d3.color(right);
    return d3.rgb(
        (1 - lambda) * lcol.r + lambda * rcol.r,
        (1 - lambda) * lcol.g + lambda * rcol.g,
        (1 - lambda) * lcol.b + lambda * rcol.b,
        (1 - lambda) * lcol.a + lambda * rcol.a
    );
}

function setLeftCoords(array) {
    let lefts =
        array.length == 0
            ? array
            : (xIter = d3.cumsum(
                  [0].concat(array.slice(0, -1).map((x) => x.value))
              ));
    return array.forEach((e, i) => (e.x = lefts[i]));
}

function draw() {
    let breakdownDiv = d3.select("#breakdown").node();
    breakdownDiv.innerHTML = "";
    let widthRatio = 0.6;
    let dims = {
        width: breakdownDiv.getClientRects()[0].width * widthRatio,
        singleHeightPx: 16,
        doubleHeightPx: 4 * 16,
    };

    // Inputs
    aim = parseInt(d3.select("#input-aim").property("value"));
    crit = parseInt(d3.select("#input-crit").property("value"));
    dodge = parseInt(d3.select("#input-dodge").property("value"));
    grazeband = parseInt(d3.select("#input-grazeband").property("value"));

    let promoteChance = Math.min(crit - Math.min(0, dodge), 100); // Negative dodge is additional crit
    let demoteChance = Math.min(Math.max(dodge, 0), 100);

    initial = makeInitialShotbar(aim);
    banded = applyGrazeBand(grazeband)(initial);
    promoted = applyHitPromotion(promoteChance)(banded);
    demoted = applyHitDemotion(demoteChance)(promoted);

    // Help texts
    d3.select("#breakdown")
        .selectAll("div")
        .data(demoted.breakdown)
        .join("div")
        .attr("class", "fancy-shape")
        .append("p")
        .text((d) => d.text)
        .append("br");

    // SVGs
    d3.select("#breakdown")
        .selectAll("div")
        .data(demoted.breakdown)
        .join("div")
        .append("svg")
        .attr("width", dims.width)
        .attr("height", (d, i) => {
            if (!Boolean(d.links)) {
                return dims.singleHeightPx;
            } else if (
                demoted.breakdown[i - 1] != undefined &&
                _.isEqual(
                    hitRankArray.map((e) => d.line2[e].value),
                    hitRankArray.map(
                        (e) => demoted.breakdown[i - 1].line2[e].value
                    )
                )
            ) {
                return 0;
            }
            return dims.doubleHeightPx;
        })
        .style("padding", "1em 0");

    // SVG rects
    d3.select("#breakdown")
        .selectAll("svg")
        .data(demoted.breakdown)
        .selectAll("g")
        .data((d) => {
            let line1 = [];
            let line2 = [];
            for (to of hitRankArray) {
                for (from of hitRankArray) {
                    rect = d.line1[from][to];
                    if (rect != undefined) {
                        rect.y = 0;
                        rect.height = dims.singleHeightPx;
                        rect.text ??= hitRankFriendlyNames[to];
                        rect.color ??= colorblend(
                            hitRankColors[from],
                            hitRankColors[to],
                            0.2
                        );
                        line1.push(rect);
                    }
                }
                rect = d.line2[to];
                rect.y = dims.doubleHeightPx - dims.singleHeightPx;
                rect.height = dims.singleHeightPx;
                rect.text = hitRankFriendlyNames[to];
                rect.color = hitRankColors[to];
                line2.push(rect);
            }
            setLeftCoords(line1);
            setLeftCoords(line2);
            line1.concat(line2).forEach((e) => {
                e.x = (e.x * dims.width) / 100;
                e.width = (e.value * dims.width) / 100;
            });
            return line1.concat(line2);
        })
        .join("rect")
        .attr("x", (d) => d.x)
        .attr("y", (d) => d.y)
        .attr("width", (d) => d.width)
        .attr("height", (d) => d.height)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", (d) => d.color)
        .attr("bigtext", (d) => decFormat(d.value) + "%")
        .attr("smalltext", (d) => d.text)
        .on("mouseleave", (event) => {
            d3.select("#tooltip").style("display", "none").html("");
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
                        event.target.y.animVal.value -
                        1 +
                        "px"
                )
                .html("");

            d3.select("#tooltip")
                .append("span")
                .style("font-size", "1.5em")
                .text(event.target.getAttribute("bigtext"))
                .append("br");
            d3.select("#tooltip")
                .append("span")
                .text(event.target.getAttribute("smalltext"));
        });

    // Links
    d3.select("#breakdown")
        .selectAll("svg")
        .data(demoted.breakdown)
        .selectAll("g")
        .data((d) => {
            if (d.links == undefined) {
                return [];
            }
            rtn = [];
            for (link of d.links) {
                rtn.push({
                    x1:
                        d.line1[link.from][link.to].x +
                        d.line1[link.from][link.to].width / 2,
                    y1:
                        d.line1[link.from][link.to].y +
                        d.line1[link.from][link.to].height,
                    x2: d.line2[link.to].x + d.line2[link.to].width / 2,
                    y2: d.line2[link.to].y,

                    display:
                        d.line1[link.from][link.to].value > 0 &&
                        d.line2[link.to].value > 0
                            ? ""
                            : "none",
                });
            }
            return rtn;
        })
        .join("path")
        .attr(
            "d",
            (d) =>
                `
                M ${d.x2} ${d.y2}
                C ${d.x2} ${(d.y1 + d.y2) / 2}
                , ${d.x1} ${(d.y1 + d.y2) / 2}
                , ${d.x1} ${d.y1}
                `
        )
        .attr("stroke", "#98c8c8")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", 4)
        .attr("stroke-linecap", "butt")
        .attr("fill", "transparent")
        .style("display", (d) => d.display);

    // Text
    d3.select("#output")
        .selectAll("div")
        .data(hitRankArray)
        .join("div")
        .text((d) => `${hitRankFriendlyNames[d]}: ${decFormat(demoted[d])}%`)
        .style("text-decoration", "underline")
        .style("text-decoration-color", (d) => hitRankColors[d])
        .style("text-decoration-thickness", "0.12em");
}
